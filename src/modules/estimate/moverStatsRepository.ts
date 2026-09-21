import { EstimateStatus } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

/*
@ 견적 목록에 붙는 기사님 집계값

- 값의 의미는 기사님 찾기 목록(moverRepository.findMany)의 SQL과 같게 맞춥니다.
  averageRating: 리뷰 평점 평균(리뷰가 없으면 0) / reviewCount: 리뷰 수
  confirmedCount: 확정(ACCEPTED)된 견적 수 / likeCount: 찜 수
- MoverProfile에 컬럼으로 없는 값이라 매번 집계해야 합니다.
  견적마다 따로 조회하면 N+1이 되므로, 페이지에 등장한 기사님 id를 모아 한 번에 집계합니다.
  (size 상한이 50이고 요청당 견적도 소수라 in 절 크기는 제한적입니다)
- isLiked는 "이 고객이 찜했는지"라 customerId가 있을 때만 채웁니다.
  기사님이 자기 견적 목록을 볼 때는 의미가 없어 아예 내려보내지 않습니다.
*/

export interface MoverStats {
  averageRating: number;
  reviewCount: number;
  confirmedCount: number;
  likeCount: number;
  isLiked?: boolean;
}

/** 집계 대상이 아직 없는 기사님의 기본값 */
export const EMPTY_MOVER_STATS: MoverStats = {
  averageRating: 0,
  reviewCount: 0,
  confirmedCount: 0,
  likeCount: 0,
};

/** 평균 평점은 소수점 첫째 자리까지 (moverMapper의 roundRating과 동일) */
const roundRating = (rating: number) => Math.round(rating * 10) / 10;

export const moverStatsRepository = {
  /** moverId → 집계값. 넘긴 id는 값이 없어도 기본값으로 채워 돌려줍니다. */
  findByMoverIds: async (
    moverIds: string[],
    customerId?: string
  ): Promise<Map<string, MoverStats>> => {
    const statsByMoverId = new Map<string, MoverStats>();

    if (moverIds.length === 0) return statsByMoverId;

    const [reviewRows, confirmedRows, likeRows, myLikeRows] = await Promise.all(
      [
        prisma.review.groupBy({
          by: ['moverId'],
          where: { moverId: { in: moverIds } },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        prisma.estimate.groupBy({
          by: ['moverId'],
          where: { moverId: { in: moverIds }, status: EstimateStatus.ACCEPTED },
          _count: { _all: true },
        }),
        prisma.like.groupBy({
          by: ['moverId'],
          where: { moverId: { in: moverIds } },
          _count: { _all: true },
        }),
        customerId
          ? prisma.like.findMany({
              where: { customerId, moverId: { in: moverIds } },
              select: { moverId: true },
            })
          : Promise.resolve([]),
      ]
    );

    const reviewByMoverId = new Map(
      reviewRows.map((row) => [row.moverId, row])
    );
    const confirmedByMoverId = new Map(
      confirmedRows.map((row) => [row.moverId, row._count._all])
    );
    const likeByMoverId = new Map(
      likeRows.map((row) => [row.moverId, row._count._all])
    );
    const likedByMe = new Set(myLikeRows.map((row) => row.moverId));

    for (const moverId of moverIds) {
      const review = reviewByMoverId.get(moverId);

      statsByMoverId.set(moverId, {
        averageRating: roundRating(review?._avg.rating ?? 0),
        reviewCount: review?._count._all ?? 0,
        confirmedCount: confirmedByMoverId.get(moverId) ?? 0,
        likeCount: likeByMoverId.get(moverId) ?? 0,
        ...(customerId ? { isLiked: likedByMe.has(moverId) } : {}),
      });
    }

    return statsByMoverId;
  },
};
