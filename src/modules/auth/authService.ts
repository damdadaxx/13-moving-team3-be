import { randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthProvider, Prisma, Role } from '../../generated/prisma/client';
import { ENV } from '../../config/env';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../utils/error';
import {
  comparePassword,
  hashPassword,
  hashRefreshToken,
  isSameSecret,
} from '../../utils/hash';
import { sendMail } from '../../utils/mailer';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  EMAIL_CODE_EXPIRES_IN,
  EMAIL_CODE_EXPIRES_MINUTES,
  EMAIL_CODE_LENGTH,
  EMAIL_VERIFIED_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from './authConstants';
import { SocialProfile } from './authPassport';
import authRepository, { PublicUser } from './authRepository';
import {
  ConfirmEmailInput,
  LoginInput,
  SendEmailCodeInput,
  SignupInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

// 타입
export type TokenPayload = {
  sub: string;
  role: Role;
};

type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

// JWT
const isRole = (value: unknown): value is Role =>
  value === 'CUSTOMER' || value === 'MOVER';

const signAccessToken = (userId: string, role: Role) =>
  jwt.sign({ role }, ENV.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const signRefreshToken = (userId: string, role: Role) =>
  jwt.sign({ role }, ENV.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

// access 토큰 검증은 middlewares/authenticate 의 express-jwt 가 담당한다(req.auth).
const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET);
    const payload = decoded as jwt.JwtPayload & { role?: unknown };
    if (!payload.sub || !isRole(payload.role)) {
      throw new UnauthorizedError('리프레시 토큰이 유효하지 않습니다.');
    }
    return { sub: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(
      '리프레시 토큰이 만료되었거나 유효하지 않습니다.'
    );
  }
};

// 로그아웃 전용: 서명은 검증하되 만료는 허용한다.
// access 토큰이 만료된 상태에서도 refresh 쿠키만으로 사용자를 식별하기 위함.
const verifyRefreshTokenAllowExpired = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET, {
      ignoreExpiration: true,
    });
    const payload = decoded as jwt.JwtPayload & { role?: unknown };
    if (!payload.sub || !isRole(payload.role)) {
      return null;
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
};

// ────────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────────

const toPublicUser = (user: {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: PublicUser['role'];
  provider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  provider: user.provider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// 매 refresh 마다 refreshToken을 회전시킨다
const issueTokens = async (user: PublicUser): Promise<AuthResult> => {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);
  await authRepository.updateRefreshToken(
    user.id,
    hashRefreshToken(refreshToken)
  );
  return { user, accessToken, refreshToken };
};

const isUniqueConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

/*
@ 인증번호 생성
- 예측이 어렵도록 crypto 난수를 쓴다. 앞자리 0 도 살린다.
*/
const createEmailVerificationCode = () => {
  const max = 10 ** EMAIL_CODE_LENGTH;
  const value = randomInt(0, max);
  return String(value).padStart(EMAIL_CODE_LENGTH, '0');
};

/*
@ 이메일 인증 토큰 (DB 없이 상태를 들고 다니는 방식)
- challenge: 인증번호 해시를 담아 서명한다. 원본 인증번호는 메일로만 나간다.
- verified: 인증을 마쳤다는 증명. 회원가입 요청에 함께 보낸다.
- purpose 를 넣어 다른 용도의 토큰이 섞여 들어오는 것을 막는다.
*/
const EMAIL_CHALLENGE_PURPOSE = 'email_challenge';
const EMAIL_VERIFIED_PURPOSE = 'email_verified';

interface EmailTokenPayload {
  purpose: string;
  email: string;
  role: Role;
  codeHash?: string;
}

const signEmailToken = (payload: EmailTokenPayload, expiresIn: string) =>
  jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });

const verifyEmailToken = (
  token: string,
  purpose: string,
  invalidMessage: string
): EmailTokenPayload => {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new BadRequestError('인증 시간이 만료되었습니다. 다시 받아주세요.');
    }
    throw new BadRequestError(invalidMessage);
  }

  const payload = decoded as Partial<EmailTokenPayload>;

  if (
    payload.purpose !== purpose ||
    typeof payload.email !== 'string' ||
    !isRole(payload.role)
  ) {
    throw new BadRequestError(invalidMessage);
  }

  return payload as EmailTokenPayload;
};

// ────────────────────────────────────────────────
// authService (public API)
// ────────────────────────────────────────────────

const authService = {
  async signUp(input: SignupInput): Promise<AuthResult> {
    const existing = await authRepository.findByEmailAndRole(
      input.email,
      input.role
    );
    if (existing) {
      throw new ConflictError('이미 사용 중인 이메일입니다.');
    }

    /*
    @ 이메일 인증 확인
    - 인증 확인 단계에서 받은 verified 토큰만 통과시킨다.
    - 토큰이 만료됐으면(30분) 인증을 다시 받아야 한다.
    */
    const verified = verifyEmailToken(
      input.emailVerificationToken,
      EMAIL_VERIFIED_PURPOSE,
      '이메일 인증을 먼저 완료해 주세요.'
    );

    if (verified.email !== input.email || verified.role !== input.role) {
      throw new BadRequestError('이메일 인증을 먼저 완료해 주세요.');
    }

    const password = await hashPassword(input.password);

    try {
      const user = await authRepository.create({
        name: input.name,
        email: input.email,
        phoneNumber: input.phoneNumber,
        password,
        role: input.role,
        provider: 'LOCAL',
      });
      return issueTokens(user);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictError('이미 사용 중인 이메일입니다.');
      }
      throw error;
    }
  },

  /*
  @ 이메일 인증번호 발송
  - 이미 가입된 이메일이면 보내지 않는다.
  - 인증번호는 메일로만 보내고, 서버는 해시를 담은 challenge 토큰만 돌려준다.
  */
  async sendEmailVerification(
    input: SendEmailCodeInput
  ): Promise<{ token: string; expiresInMinutes: number }> {
    const existing = await authRepository.findByEmailAndRole(
      input.email,
      input.role
    );
    if (existing) {
      throw new ConflictError('이미 사용 중인 이메일입니다.');
    }

    const code = createEmailVerificationCode();
    const token = signEmailToken(
      {
        purpose: EMAIL_CHALLENGE_PURPOSE,
        email: input.email,
        role: input.role,
        codeHash: hashRefreshToken(code),
      },
      EMAIL_CODE_EXPIRES_IN
    );

    await sendMail({
      to: input.email,
      subject: '[무빙] 회원가입 인증번호',
      text: `인증번호는 ${code} 입니다. ${EMAIL_CODE_EXPIRES_MINUTES}분 안에 입력해 주세요.`,
    });

    return { token, expiresInMinutes: EMAIL_CODE_EXPIRES_MINUTES };
  },

  /*
  @ 이메일 인증번호 확인
  - challenge 토큰의 이메일·역할이 요청과 같은지 확인한 뒤 인증번호 해시를 비교한다.
  - 통과하면 회원가입에 쓸 verified 토큰을 돌려준다.
  */
  async confirmEmailVerification(
    input: ConfirmEmailInput
  ): Promise<{ token: string }> {
    const payload = verifyEmailToken(
      input.token,
      EMAIL_CHALLENGE_PURPOSE,
      '인증번호를 다시 받아주세요.'
    );

    if (payload.email !== input.email || payload.role !== input.role) {
      throw new BadRequestError('인증번호를 다시 받아주세요.');
    }

    if (
      !payload.codeHash ||
      !isSameSecret(hashRefreshToken(input.code), payload.codeHash)
    ) {
      throw new BadRequestError('인증번호가 올바르지 않습니다.');
    }

    const token = signEmailToken(
      {
        purpose: EMAIL_VERIFIED_PURPOSE,
        email: input.email,
        role: input.role,
      },
      EMAIL_VERIFIED_EXPIRES_IN
    );

    return { token };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await authRepository.findByEmailAndRole(
      input.email,
      input.role
    );

    // 이메일 없음 / 비밀번호 불일치 / 소셜 가입 계정을 모두 같은 응답으로 통일한다.
    // (구분하면 "이 이메일은 가입돼 있다"는 계정 존재 여부가 노출됨)
    if (!user || user.provider !== 'LOCAL' || !user.password) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 비밀번호 시도 횟수 제한은 라우터의 loginRateLimit 이 계정 단위로 처리한다 (authRateLimit.ts)
    const matches = await comparePassword(input.password, user.password);
    if (!matches) {
      throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return issueTokens(toPublicUser(user));
  },

  async logout(refreshToken: string) {
    // 서명은 검증하되 만료는 허용 — access 만료 상태에서도 정리 가능하게
    const payload = verifyRefreshTokenAllowExpired(refreshToken);
    if (!payload) {
      return;
    }
    const user = await authRepository.findById(payload.sub);
    // 저장된 해시와 일치할 때만 정리 = 이 refresh 토큰의 실제 보유자임을 증명
    if (
      user?.refreshToken &&
      user.refreshToken === hashRefreshToken(refreshToken)
    ) {
      await authRepository.updateRefreshToken(user.id, null);
    }
  },

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedError('리프레시 토큰이 없습니다.');
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await authRepository.findById(payload.sub);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedError('리프레시 토큰이 유효하지 않습니다.');
    }
    // 같지 않으면 세션을 통째로 wipe
    // TODO: 탭 두개이상이 열려서 같이 만료됐다가 같이 재발급될시 문제점 발생
    if (user.refreshToken !== hashRefreshToken(refreshToken)) {
      await authRepository.updateRefreshToken(user.id, null);
      throw new UnauthorizedError('리프레시 토큰이 유효하지 않습니다.');
    }

    if (user.role !== payload.role) {
      throw new UnauthorizedError('리프레시 토큰이 유효하지 않습니다.');
    }

    return issueTokens(toPublicUser(user));
  },

  async getMe(userId: string): Promise<PublicUser> {
    const user = await authRepository.findPublicById(userId);
    // TODO: 쿠키는 유효한데 유저만 없는 상황(탈퇴 등). 401 이면 프론트가 refresh 재시도 →
    //   무한 루프 가능. 프론트가 이 케이스에선 쿠키 정리 후 로그인 화면으로 보내도록 협의 필요.
    if (!user) {
      throw new UnauthorizedError('유저를 찾을 수 없습니다.');
    }
    return user;
  },

  async updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
    return authRepository.updateProfile(userId, input);
  },

  async changePassword(userId: string, input: UpdatePasswordInput) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('유저를 찾을 수 없습니다.');
    }

    if (user.provider !== 'LOCAL' || !user.password) {
      throw new ForbiddenError(
        '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.'
      );
    }

    const matches = await comparePassword(input.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestError('현재 비밀번호가 올바르지 않습니다.');
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
    }

    const password = await hashPassword(input.newPassword);
    await authRepository.updatePassword(user.id, password);
    // TODO: 비밀번호 변경 시 기존 refreshToken 무효화(updateRefreshToken(user.id, null))로
    //   다른 기기/세션 재로그인 유도. 현재는 변경 후에도 기존 세션이 그대로 유효함.
  },

  // Passport 가 조회·정규화한 프로필로 provider+role 유저를 찾거나 만든다. (authPassport.ts)
  async socialLogin(profile: SocialProfile, role: Role): Promise<AuthResult> {
    if (!profile.email) {
      throw new BadRequestError(
        '소셜 계정에서 이메일을 가져올 수 없습니다. 이메일 제공에 동의해 주세요.'
      );
    }

    const existingByProvider = await authRepository.findByProviderAndRole(
      profile.provider,
      profile.providerId,
      role
    );
    if (existingByProvider) {
      return issueTokens(toPublicUser(existingByProvider));
    }

    const existingByEmail = await authRepository.findByEmailAndRole(
      profile.email,
      role
    );
    if (existingByEmail) {
      throw new ConflictError('이미 사용 중인 이메일입니다.');
    }
    // TODO: 간편로그인 구현 이후 에러 메세지 분기 or 비번 확인후 소셜 계정을 기존 계정에 연동하는 로직 필요

    try {
      const user = await authRepository.create({
        name: profile.name,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        role,
        provider: profile.provider,
        providerId: profile.providerId,
      });
      return issueTokens(user);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictError('이미 가입된 계정입니다.');
      }
      throw error;
    }
  },
};

export default authService;
