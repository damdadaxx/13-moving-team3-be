import { prisma } from '../../lib/prisma';
import { Prisma } from '../../generated/prisma/client';
import { ConflictError } from '../../utils/error';

/** 커서 페이지네이션 기본 페이지 크기 */
const DEFAULT_LIMIT = 4;

/** 견적 요청 1건당 보낼 수 있는 지정 견적 요청 수 상한 */
const DESIGNATED_LIMIT = 3;

// select가 중복되어 분리
const estimateRequestSelect = {
  id: true,
  customerId: true,
  serviceType: true,
  moveDate: true,
  departureAddress: true,
  arrivalAddress: true,
  status: true,
  estimates: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      price: true,
      comment: true,
      isDesignated: true,
      status: true,
      rejectReason: true,
      mover: {
        select: {
          userId: true,
          nickname: true,
          imgUrl: true,
          careerMonths: true,
          user: { select: { name: true } },
          // 리뷰 총 개수 / 확정(ACCEPTED)된 견적 총 개수 / 찜 받은 수
          _count: {
            select: {
              reviews: true,
              estimates: { where: { status: 'ACCEPTED' } },
              likedBy: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EstimateRequestSelect;

type EstimateRequestRow = Prisma.EstimateRequestGetPayload<{
  select: typeof estimateRequestSelect;
}>;

// 견적 요청 생성에 필요한 입력값.
// status/createdAt 등 서버가 정하는 값은 받지 않습니다.
export type CreateEstimateRequestInput = Pick<
  Prisma.EstimateRequestUncheckedCreateInput,
  | 'customerId'
  | 'serviceType'
  | 'moveDate'
  | 'departureZipCode'
  | 'departureAddress'
  | 'arrivalZipCode'
  | 'arrivalAddress'
>;

// 지정 견적 요청 입력값. isDesignated/status는 서버가 고정합니다.
export type CreateDirectEstimateRequestInput = Pick<
  Prisma.EstimateUncheckedCreateInput,
  'estimateRequestId' | 'moverId'
>;

/**
 * 각 기사님의 평점 평균을 붙여 반환합니다.
 * 평점 평균은 관계 안에서 집계할 수 없어 groupBy로 한 번에 조회하며,
 * 요청이 몇 건이든 추가 쿼리는 1회입니다.
 */
async function attachMoverStats(rows: EstimateRequestRow[]) {
  const moverIdSet = new Set<string>();
  for (const row of rows) {
    for (const estimate of row.estimates) {
      moverIdSet.add(estimate.mover.userId);
    }
  }
  const moverIds = Array.from(moverIdSet);

  const ratings = moverIds.length
    ? await prisma.review.groupBy({
        by: ['moverId'],
        where: { moverId: { in: moverIds } },
        _avg: { rating: true },
      })
    : [];

  const averageByMoverId = new Map(
    ratings.map((row) => [row.moverId, row._avg.rating])
  );

  return rows.map((row) => ({
    ...row,
    estimates: row.estimates.map((estimate) => {
      const { _count, ...mover } = estimate.mover;
      const average = averageByMoverId.get(mover.userId) ?? null;

      return {
        ...estimate,
        mover: {
          ...mover,
          reviewCount: _count.reviews,
          // 소수점 첫째 자리까지 반올림 (리뷰가 없으면 null)
          averageRating:
            average === null ? null : Math.round(average * 10) / 10,
          confirmedEstimateCount: _count.estimates,
          likeCount: _count.likedBy,
        },
      };
    }),
  }));
}

export const estimateRequestRepository = {
  // 단건견적
  // 진행 중(PENDING, CONFIRMED)인 요청 1건을 조회합니다.
  async findActiveByCustomerId(customerId: string) {
    const estimateRequest = await prisma.estimateRequest.findFirst({
      where: {
        customerId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: estimateRequestSelect,
    });

    if (!estimateRequest) return null;

    const [withStats] = await attachMoverStats([estimateRequest]);
    return withStats ?? null;
  },

  // 이사 이력 목록 - 이사일이 지난 요청(COMPLETED, EXPIRED)만 조회합니다.
  // 커서 기반 무한 스크롤. cursor는 직전 페이지 마지막 요청의 id입니다.
  // 반환 데이터 구조는 findActiveByCustomerId와 동일합니다.
  async findByEstimateUserId(
    customerId: string,
    { cursor, limit = DEFAULT_LIMIT }: { cursor?: string; limit?: number } = {}
  ) {
    // 다음 페이지 존재 여부를 알기 위해 1건 더 조회합니다.
    const rows = await prisma.estimateRequest.findMany({
      where: {
        customerId,
        status: { in: ['COMPLETED', 'EXPIRED'] },
      },
      // createdAt이 같은 건이 있어도 순서가 흔들리지 않도록 id를 2차 정렬로 둡니다.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: estimateRequestSelect,
    });

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];

    return {
      items: await attachMoverStats(pageRows),
      nextCursor: hasNext && lastRow ? lastRow.id : null,
      hasNext,
    };
  },
  // 견적요청
  // 요청 생성과 고객 프로필의 활성 요청 연결을 한 트랜잭션으로 처리합니다.
  // 이미 진행 중(PENDING, CONFIRMED)인 요청이 있으면 부분 유니크 인덱스에 걸려
  // P2002(PrismaClientKnownRequestError)가 발생합니다. -> service에서 409로 변환
  async createEstimateRequest(input: CreateEstimateRequestInput) {
    const created = await prisma.$transaction(async (tx) => {
      // status는 스키마 기본값 PENDING으로 생성됩니다.
      const estimateRequest = await tx.estimateRequest.create({
        data: input,
        select: estimateRequestSelect,
      });

      await tx.customerProfile.update({
        where: { userId: input.customerId },
        data: { activeEstimateRequestId: estimateRequest.id },
      });

      return estimateRequest;
    });

    // 생성 직후에는 견적이 없지만 조회 함수들과 반환 구조를 맞춥니다.
    const [withStats] = await attachMoverStats([created]);
    return withStats ?? null;
  },
  // 지정견적생성
  // 요청 1건당 지정 견적은 최대 DESIGNATED_LIMIT건까지 가능합니다.
  // 상한 초과 시 ConflictError를 던져 생성을 롤백하려고 트랜잭션으로 묶습니다.
  // 다만 기본 격리 수준(READ COMMITTED)에서 count는 락을 잡지 않으므로,
  // 동시 요청이 겹치면 상한을 넘길 수 있습니다. 엄격히 막으려면
  // isolationLevel: 'Serializable' 또는 부모 행 SELECT ... FOR UPDATE가 필요합니다.
  // 같은 기사님에게 이미 요청했다면 @@unique([estimateRequestId, moverId])에 걸려
  // P2002가 발생합니다. -> service에서 409로 변환
  async createDirectEstimateRequest({
    estimateRequestId,
    moverId,
  }: CreateDirectEstimateRequestInput) {
    return prisma.$transaction(async (tx) => {
      const designatedCount = await tx.estimate.count({
        where: { estimateRequestId, isDesignated: true },
      });

      if (designatedCount >= DESIGNATED_LIMIT) {
        throw new ConflictError(
          `지정 견적 요청은 최대 ${DESIGNATED_LIMIT}건까지 가능합니다.`
        );
      }

      return tx.estimate.create({
        data: {
          estimateRequestId,
          moverId,
          isDesignated: true,
          status: 'DESIGNATED',
        },
        select: {
          id: true,
          isDesignated: true,
          status: true,
          mover: {
            select: {
              userId: true,
              nickname: true,
              user: { select: { name: true } },
            },
          },
        },
      });
    });
  },

  // 이사일 경과 처리 (스케줄러에서 주기적으로 호출)
  // CONFIRMED -> COMPLETED (이사 완료), PENDING -> EXPIRED (확정 없이 경과)
  // 처리된 요청은 고객 프로필의 활성 요청 연결도 함께 해제합니다.
  // 상태만 바뀌고 연결이 남으면 새 견적 요청을 넣을 수 없으므로 한 트랜잭션으로 묶습니다.
  async closePastEstimateRequests(now: Date = new Date()) {
    return prisma.$transaction(async (tx) => {
      const targets = await tx.estimateRequest.findMany({
        where: {
          moveDate: { lt: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { id: true, status: true },
      });

      if (targets.length === 0) {
        return { completed: 0, expired: 0, expiredEstimates: 0 };
      }

      const completedIds: string[] = [];
      const expiredIds: string[] = [];
      for (const target of targets) {
        if (target.status === 'CONFIRMED') {
          completedIds.push(target.id);
        } else {
          expiredIds.push(target.id);
        }
      }

      if (completedIds.length > 0) {
        await tx.estimateRequest.updateMany({
          where: { id: { in: completedIds } },
          data: { status: 'COMPLETED' },
        });
      }

      let expiredEstimates = 0;
      if (expiredIds.length > 0) {
        await tx.estimateRequest.updateMany({
          where: { id: { in: expiredIds } },
          data: { status: 'EXPIRED' },
        });

        // 만료된 요청에 달린 대기 중 견적도 함께 만료 처리합니다.
        // REJECTED(반려)는 이미 종료된 상태라 그대로 둡니다.
        const { count } = await tx.estimate.updateMany({
          where: {
            estimateRequestId: { in: expiredIds },
            status: { in: ['PROPOSED', 'DESIGNATED'] },
          },
          data: { status: 'EXPIRED' },
        });
        expiredEstimates = count;
      }

      // 활성 요청으로 연결돼 있던 고객 프로필을 모두 해제합니다.
      await tx.customerProfile.updateMany({
        where: {
          activeEstimateRequestId: { in: targets.map((target) => target.id) },
        },
        data: { activeEstimateRequestId: null },
      });

      return {
        completed: completedIds.length,
        expired: expiredIds.length,
        expiredEstimates,
      };
    });
  },
};
