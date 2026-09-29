import { prisma } from '../../lib/prisma';
import { AuthProvider, Role } from '../../generated/prisma/client';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  provider: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: Role;
  provider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
};

const authRepository = {
  findByEmailAndRole(email: string, role: Role) {
    return prisma.user.findUnique({
      where: { email_role: { email, role } },
    });
  },

  findByProviderAndRole(
    provider: AuthProvider,
    providerId: string,
    role: Role
  ) {
    return prisma.user.findUnique({
      where: { provider_providerId_role: { provider, providerId, role } },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  findPublicById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  },

  create(data: {
    name: string;
    email: string;
    phoneNumber?: string | null;
    password?: string | null;
    role: Role;
    provider: AuthProvider;
    providerId?: string | null;
    refreshToken?: string | null;
  }) {
    return prisma.user.create({
      data,
      select: publicUserSelect,
    });
  },

  updateRefreshToken(id: string, refreshToken: string | null) {
    return prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  },

  updateProfile(
    id: string,
    data: { name?: string; phoneNumber?: string | null }
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  },

  updatePassword(id: string, password: string) {
    return prisma.user.update({
      where: { id },
      data: { password },
    });
  },

  /*
  @ 로그인 비밀번호 잠금
  - registerFailedLogin: 이번 실패까지 포함한 시도 횟수를 반환한다. 임계값 도달 여부는 서비스가 판단한다.
  - lockUntil: 임계값에 도달했을 때만 호출한다. 다음 창을 위해 카운트를 0으로 되돌린다.
  - resetLoginLock: 로그인에 성공했을 때 호출한다.
  */
  async registerFailedLogin(id: string): Promise<number> {
    const user = await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    return user.failedLoginAttempts;
  },

  lockUntil(id: string, until: Date) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: until },
    });
  },

  resetLoginLock(id: string) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};

export default authRepository;
