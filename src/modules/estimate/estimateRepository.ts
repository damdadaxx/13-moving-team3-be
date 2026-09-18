import { prisma } from '../../lib/prisma';
import { Prisma } from '../../generated/prisma/client';
import { ConflictError } from '../../utils/error';

// 견적 요청 1건당 지정 없이(일반) 보낼 수 있는 견적 수 상한.
// 지정 견적(DESIGNATED) 상한은 estimate-request/estimateRequestRepository.ts의 DESIGNATED_LIMIT.
const GENERAL_LIMIT = 5;

export type CreateGeneralEstimateInput = Pick<
  Prisma.EstimateUncheckedCreateInput,
  'estimateRequestId' | 'moverId' | 'price' | 'comment'
>;

export const estimateRepository = {
  findByIdWithDetail: (id: string) => {
    return prisma.estimate.findUnique({
      where: { id },
      include: {
        mover: {
          select: {
            userId: true,
            nickname: true,
            imgUrl: true,
            careerMonths: true,
            user: { select: { name: true } },
          },
        },
        estimateRequest: {
          include: {
            customer: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        review: true,
      },
    });
  },

  update: (
    id: string,
    data: Prisma.EstimateUpdateInput,
    tx?: Prisma.TransactionClient
  ) => {
    return (tx ?? prisma).estimate.update({ where: { id }, data });
  },

  // 지정 없이 견적을 새로 보낸다 (isDesignated: false, 바로 PROPOSED).
  // 상한 초과 시 ConflictError를 던져 생성을 롤백하려고 count와 create를 트랜잭션으로 묶는다.
  // 같은 요청에 이미 견적이 있으면(지정 포함) @@unique([estimateRequestId, moverId])에 걸려
  // P2002가 발생한다. -> service에서 409로 변환
  createGeneral: ({
    estimateRequestId,
    moverId,
    price,
    comment,
  }: CreateGeneralEstimateInput) => {
    return prisma.$transaction(async (tx) => {
      const generalCount = await tx.estimate.count({
        where: { estimateRequestId, isDesignated: false },
      });

      if (generalCount >= GENERAL_LIMIT) {
        throw new ConflictError(
          `견적은 요청당 최대 ${GENERAL_LIMIT}건까지 보낼 수 있습니다.`
        );
      }

      return tx.estimate.create({
        data: {
          estimateRequestId,
          moverId,
          price,
          comment,
          isDesignated: false,
          status: 'PROPOSED',
        },
      });
    });
  },

  // 견적 확정: 해당 견적은 ACCEPTED, 같은 요청의 나머지 PROPOSED 견적은 NOT_SELECTED,
  // 견적 요청은 CONFIRMED로 같이 전환한다. DESIGNATED로 남은 행은 건드리지 않는다.
  confirmAndCloseOthers: async (
    params: {
      estimateId: string;
      estimateRequestId: string;
    },
    tx?: Prisma.TransactionClient
  ) => {
    const run = async (client: Prisma.TransactionClient) => {
      // 해당 견적은 ACCEPTED로 변경
      await client.estimate.update({
        where: { id: params.estimateId },
        data: { status: 'ACCEPTED' },
      });

      // 같은 요청의 나머지 PROPOSED 견적은 NOT_SELECTED로 변경
      await client.estimate.updateMany({
        where: {
          estimateRequestId: params.estimateRequestId,
          status: 'PROPOSED',
          id: { not: params.estimateId },
        },
        data: { status: 'NOT_SELECTED' },
      });

      // 견적 요청은 CONFIRMED로 전환
      await client.estimateRequest.update({
        where: { id: params.estimateRequestId },
        data: { status: 'CONFIRMED' },
      });
    };

    if (tx) return run(tx);
    return prisma.$transaction((tx) => run(tx));
  },
};
