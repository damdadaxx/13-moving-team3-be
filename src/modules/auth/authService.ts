import { AuthProvider, Prisma } from '../../generated/prisma/client';
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
} from '../../utils/hash';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyRefreshTokenAllowExpired,
} from './authJwt';
import { authRepository, PublicUser } from './authRepository';
import { SocialProfile } from './authTypes';
import {
  LoginInput,
  SignupInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

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
  },

  async socialLogin(
    profile: SocialProfile,
    role: PublicUser['role']
  ): Promise<AuthResult> {
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
