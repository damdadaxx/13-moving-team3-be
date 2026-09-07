import jwt from 'jsonwebtoken';
import { AuthProvider, Prisma, Role } from '../../generated/prisma/client';
import { ENV } from '../../config/env';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../utils/error';
import {
  comparePassword,
  hashPassword,
  hashRefreshToken,
} from '../../utils/hash';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from './authConstants';
import { authRepository, PublicUser } from './authRepository';
import {
  LoginInput,
  ProviderParam,
  SignupInput,
  SocialAuthInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

// 타입
export type TokenPayload = {
  sub: string;
  role: Role;
};

type SocialProvider = 'google' | 'kakao' | 'naver';

type SocialProfile = {
  provider: AuthProvider;
  providerId: string;
  email?: string;
  name: string;
  phoneNumber?: string;
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

// 미들웨어(authenticate)에서 사용
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    const payload = decoded as jwt.JwtPayload & { role?: unknown };
    if (!payload.sub || !isRole(payload.role)) {
      throw new UnauthorizedError('액세스 토큰이 유효하지 않습니다.');
    }
    return { sub: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(
      '액세스 토큰이 만료되었거나 유효하지 않습니다.'
    );
  }
};

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

// 소셜 프로바이더 연동 (프론트 릴레이: 프론트가 받은 code 를 백엔드가 교환)
type ProviderConfig = {
  authProvider: AuthProvider;
  tokenUrl: string;
  userInfoUrl: string;
  clientId?: string;
  clientSecret?: string;
};

const socialConfigs: Record<SocialProvider, ProviderConfig> = {
  google: {
    authProvider: 'GOOGLE',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientId: ENV.GOOGLE_CLIENT_ID,
    clientSecret: ENV.GOOGLE_CLIENT_SECRET,
  },
  kakao: {
    authProvider: 'KAKAO',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
    clientId: ENV.KAKAO_CLIENT_ID,
    clientSecret: ENV.KAKAO_CLIENT_SECRET,
  },
  naver: {
    authProvider: 'NAVER',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    userInfoUrl: 'https://openapi.naver.com/v1/nid/me',
    clientId: ENV.NAVER_CLIENT_ID,
    clientSecret: ENV.NAVER_CLIENT_SECRET,
  },
};

type GoogleUserInfo = { sub?: string; email?: string; name?: string };
type KakaoUserInfo = {
  id?: number | string;
  kakao_account?: {
    email?: string;
    phone_number?: string;
    profile?: { nickname?: string };
  };
};
type NaverUserInfo = {
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    mobile?: string;
  };
};

const normalizeEmail = (email: unknown) =>
  typeof email === 'string' && email.trim()
    ? email.trim().toLowerCase()
    : undefined;

const isSocialConfigured = (provider: SocialProvider) =>
  Boolean(
    socialConfigs[provider].clientId && socialConfigs[provider].clientSecret
  );

/** code → access_token 교환 */
const exchangeSocialCode = async (
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  state?: string
): Promise<string> => {
  const config = socialConfigs[provider];
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId!,
    client_secret: config.clientSecret!,
    code,
  });
  // TODO: OAuth state(CSRF 방어) 검증이 백엔드에 없음. 프론트 릴레이 구조라 state 생성·검증은
  //   전적으로 프론트 책임 상태. 네이버 state 도 여기선 그대로 전달만 하고 우리가 발급한 값인지 확인하지 않음. 프론트팀과 "state 는 프론트가 생성/검증한다" 문서로 합의 필요.
  // 네이버는 redirect_uri 대신 state 를 요구하고, 나머지는 redirect_uri 를 요구한다.
  if (provider === 'naver') {
    params.set('state', state ?? '');
  } else {
    params.set('redirect_uri', redirectUri);
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    if (ENV.NODE_ENV !== 'production') {
      console.error(`[social] ${provider} token exchange failed`, data);
    }
    throw new BadRequestError('소셜 인증에 실패했습니다.');
  }
  return data.access_token;
};

/** access_token → 프로필 조회 및 정규화 */
const fetchSocialProfile = async (
  provider: SocialProvider,
  accessToken: string
): Promise<SocialProfile> => {
  const res = await fetch(socialConfigs[provider].userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new BadRequestError('소셜 프로필 조회에 실패했습니다.');
  }
  const data: unknown = await res.json();

  switch (provider) {
    // TODO: providerId 가 없을 때 String(undefined) → "undefined" 문자열로 저장/조회됨.
    //   각 case 에서 id 누락 시 BadRequestError 로 가드 필요.
    // TODO: 소셜 phoneNumber(카카오 "+82 10-...", 네이버 "010-...")를 정규화 없이 저장.
    //   회원가입 폼의 전화번호 형식과 불일치 → 저장 전 정규화 필요.
    case 'google': {
      const d = (data ?? {}) as GoogleUserInfo;
      return {
        provider: 'GOOGLE',
        providerId: String(d.sub),
        email: normalizeEmail(d.email),
        name: d.name || '사용자',
      };
    }
    case 'kakao': {
      const d = (data ?? {}) as KakaoUserInfo;
      const account = d.kakao_account ?? {};
      return {
        provider: 'KAKAO',
        providerId: String(d.id),
        email: normalizeEmail(account.email),
        name: account.profile?.nickname || '사용자',
        phoneNumber: account.phone_number,
      };
    }
    case 'naver': {
      const d = (data ?? {}) as NaverUserInfo;
      const response = d.response ?? {};
      return {
        provider: 'NAVER',
        providerId: String(response.id),
        email: normalizeEmail(response.email),
        name: response.nickname || response.name || '사용자',
        phoneNumber: response.mobile,
      };
    }
  }
};

const getSocialProfile = async (
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  state?: string
): Promise<SocialProfile> => {
  if (!isSocialConfigured(provider)) {
    throw new AppError('해당 소셜 로그인이 설정되지 않았습니다.', 503);
  }
  const accessToken = await exchangeSocialCode(
    provider,
    code,
    redirectUri,
    state
  );
  return fetchSocialProfile(provider, accessToken);
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

// ────────────────────────────────────────────────
// authService (public API)
// ────────────────────────────────────────────────

export const authService = {
  async signUp(input: SignupInput): Promise<AuthResult> {
    const existing = await authRepository.findByEmailAndRole(
      input.email,
      input.role
    );
    if (existing) {
      throw new ConflictError('이미 사용 중인 이메일입니다.');
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

  // 프론트가 넘긴 code 를 교환해 프로필을 얻고, provider+role 로 유저를 찾거나 만든다.
  async socialLogin(
    input: ProviderParam & SocialAuthInput
  ): Promise<AuthResult> {
    const profile = await getSocialProfile(
      input.provider,
      input.code,
      input.redirectUri,
      input.state
    );
    const { role } = input;

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
