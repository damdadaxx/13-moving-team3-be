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
};

export default authRepository;
