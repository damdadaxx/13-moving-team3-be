import { prisma } from '../../lib/prisma';
import { Role } from '../../generated/prisma/client';

export const chatRoomRepository = {
  /** 채팅방 접근 판단에 필요한 최소 정보만 조회한다. */
  findAccessInfo: (estimateId: string) => {
    return prisma.estimate.findUnique({
      where: { id: estimateId },
      select: {
        id: true,
        status: true,
        moverId: true,
        estimateRequest: {
          select: { status: true, customerId: true },
        },
      },
    });
  },

  /** 내가 참여 중인 채팅방(확정 견적) 목록 + 상대방 정보 조회 */
  findRoomsForUser: (userId: string, role: Role) => {
    return prisma.estimate.findMany({
      where: {
        status: 'ACCEPTED',
        ...(role === Role.MOVER ? { moverId: userId } : {}),
        estimateRequest: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          ...(role === Role.CUSTOMER ? { customerId: userId } : {}),
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        mover: { select: { userId: true, nickname: true, imgUrl: true } },
        estimateRequest: {
          select: {
            customerId: true,
            customer: {
              select: { imgUrl: true, user: { select: { name: true } } },
            },
          },
        },
      },
    });
  },
};
