import { prisma } from '../../lib/prisma';
import { Prisma, Region, ServiceType } from '../../generated/prisma/client';
import { ConflictError } from '../../utils/error';
import { buildCursorArgs } from '../../utils/cursorPagination';
import type { ReceivedRequestsQuery } from './estimateRequestSchema';

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

/*
@ receivedRequestSelect

- 기사님이 받은 요청 카드에 필요한 값만 담는다.
- estimates 는 "나에게 지정된 견적인지" 판단용이라 moverId 로 내 것만 걸러 가져온다.
  다른 기사님의 견적(금액·코멘트)은 내려주지 않는다.
- moverId 가 where 에 들어가야 해서 상수가 아니라 함수다.
*/
const receivedRequestSelect = (moverId: string) =>
  ({
    id: true,
    serviceType: true,
    moveDate: true,
    departureAddress: true,
    arrivalAddress: true,
    createdAt: true,
    customer: {
      select: {
        userId: true,
        region: true,
        user: { select: { name: true } },
      },
    },
    estimates: {
      where: { moverId, isDesignated: true, status: 'DESIGNATED' as const },
      select: { id: true },
    },
  }) satisfies Prisma.EstimateRequestSelect;

export type ReceivedRequestRow = Prisma.EstimateRequestGetPayload<{
  select: ReturnType<typeof receivedRequestSelect>;
}>;

/*
@ escapeLike

- Prisma 의 contains 는 값을 파라미터로 바인딩하지만 LIKE 특수문자는 그대로 둔다.
  이스케이프하지 않으면 검색어의 % 는 "아무 문자열", _ 는 "아무 한 글자"로 해석돼
  `keyword=_` 하나로 전체가 매칭된다.
- Postgres LIKE 의 기본 escape 문자는 백슬래시다. 백슬래시 자신을 먼저 처리해야
  이스케이프가 중첩되지 않는다.
*/
const escapeLike = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/** 받은 요청 목록의 정렬·페이지 옵션 */
export type ReceivedListParams = Pick<
  ReceivedRequestsQuery,
  'sortBy' | 'cursor' | 'size'
>;

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
  async createDirectEstimateRequest(
    { estimateRequestId, moverId }: CreateDirectEstimateRequestInput,
    tx?: Prisma.TransactionClient
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      const designatedCount = await client.estimate.count({
        where: { estimateRequestId, isDesignated: true },
      });

      if (designatedCount >= DESIGNATED_LIMIT) {
        throw new ConflictError(
          `지정 견적 요청은 최대 ${DESIGNATED_LIMIT}건까지 가능합니다.`
        );
      }

      return client.estimate.create({
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
    };

    if (tx) return run(tx);
    return prisma.$transaction((client) => run(client));
  },

  /*=================================================
  기사님이 받은 요청 목록
  =================================================*/

  /*
  @ findMoverServiceScope

  - 받은 요청의 기본 범위를 정하려면 기사님의 제공 서비스와 서비스 가능 지역이 필요하다.
  - 목록 쿼리 앞에 1회만 조회한다.
  */
  async findMoverServiceScope(moverId: string) {
    return prisma.moverProfile.findUnique({
      where: { userId: moverId },
      select: {
        serviceTypes: { select: { serviceType: true } },
        serviceRegions: { select: { region: true } },
      },
    });
  },

  /*
  @ 받은 요청의 범위 (buildReceivedWhere)

  기본 조건
  - status = PENDING : 확정된 요청에는 더 이상 견적을 보낼 수 없다
  - moveDate > now   : 이사일이 지난 요청은 제외한다
  - 아직 응답하지 않은 요청만 : 이미 PROPOSED/REJECTED 로 응답했다면 목록에서 사라진다
    (DESIGNATED 는 "요청받았지만 아직 응답 전" 이므로 남는다)

  노출 조건 — 아래 둘 중 하나
  - 서비스·지역이 맞는 요청 : serviceType 이 제공 서비스에 있고, 고객 지역이 서비스 지역에 있다
  - 나에게 온 지정 견적     : 고객이 콕 집어 요청한 것이므로 서비스·지역 밖이어도 보여준다

  @ 지역 매칭
  - EstimateRequest 에는 지역 컬럼이 없어 customer.region(고객 프로필 지역)으로 매칭한다.
  - 이사 출발/도착지가 아니라 고객의 거주 지역 기준이라는 점을 알고 써야 한다.
  */
  buildReceivedWhere({
    moverId,
    profileServiceTypes,
    profileRegions,
    filterServiceTypes,
    filterRegions,
    isDesignated,
    keyword,
    now = new Date(),
  }: {
    moverId: string;
    /** 자격 — 기사님 프로필의 제공 서비스·서비스 지역 */
    profileServiceTypes: ServiceType[];
    profileRegions: Region[];
    /** 필터 — 기사님이 쿼리로 고른 값 */
    filterServiceTypes?: ServiceType[];
    filterRegions?: Region[];
    isDesignated?: boolean;
    keyword?: string;
    now?: Date;
  }): Prisma.EstimateRequestWhereInput {
    /*
    @ 자격(matchesServiceArea)과 필터를 분리하는 이유

    - 자격은 "지정이 아닌 요청을 볼 수 있는가"라 OR 의 한쪽 팔에만 들어간다.
    - 필터를 여기에 같이 넣으면 OR 의 다른 팔(designatedToMe)로 통과하는
      지정 견적이 필터를 통째로 우회한다. 필터는 AND 로 뺀다.
    - 자격에는 프로필 값만 쓴다. 필터로 프로필 밖 값을 보내도 지정이 아닌 요청은
      여기서 걸리므로 서비스 범위를 넘겨볼 수 없다.
    */
    const matchesServiceArea: Prisma.EstimateRequestWhereInput = {
      serviceType: { in: profileServiceTypes },
      customer: { region: { in: profileRegions } },
    };

    const designatedToMe: Prisma.EstimateRequestWhereInput = {
      estimates: {
        some: { moverId, isDesignated: true, status: 'DESIGNATED' },
      },
    };

    // DESIGNATED 외의 상태로 이미 응답한 요청은 제외한다.
    const notRespondedByMe: Prisma.EstimateRequestWhereInput = {
      estimates: { none: { moverId, status: { not: 'DESIGNATED' } } },
    };

    // 나에게 지정된 견적이 전혀 없는 요청
    const notDesignatedToMe: Prisma.EstimateRequestWhereInput = {
      estimates: { none: { moverId, isDesignated: true } },
    };

    const base: Prisma.EstimateRequestWhereInput = {
      status: 'PENDING',
      moveDate: { gt: now },
    };

    /*
    @ 조건은 반드시 AND 배열로 합친다

    - estimates / customer 를 쓰는 조건이 여러 개라 객체 스프레드로 합치면
      뒤 값이 앞 값을 덮어 먼저 온 조건이 조용히 사라진다. (키 충돌)
    - AND 로 묶으면 각 조건이 독립적으로 살아남는다.
    */
    const conditions: Prisma.EstimateRequestWhereInput[] = [notRespondedByMe];

    /*
    @ 사용자 필터는 전부 AND 로

    - 지정 견적이든 아니든, 어느 분기로 들어오든 똑같이 걸려야 한다.
    - 고객 이름은 부분 일치(contains)에 대소문자를 무시한다. Postgres 에서는 ILIKE 로 나간다.
    */
    if (filterServiceTypes) {
      conditions.push({ serviceType: { in: filterServiceTypes } });
    }

    if (filterRegions) {
      conditions.push({ customer: { region: { in: filterRegions } } });
    }

    if (keyword) {
      conditions.push({
        customer: {
          user: {
            name: { contains: escapeLike(keyword), mode: 'insensitive' },
          },
        },
      });
    }

    if (isDesignated === true) {
      // 지정 견적만 — 서비스·지역과 무관하게 나에게 지정된 것
      return { ...base, AND: [...conditions, designatedToMe] };
    }

    if (isDesignated === false) {
      // 지정이 아닌 요청만
      return {
        ...base,
        ...matchesServiceArea,
        AND: [...conditions, notDesignatedToMe],
      };
    }

    return {
      ...base,
      AND: conditions,
      OR: [matchesServiceArea, designatedToMe],
    };
  },

  /*
  @ findReceivedByMoverId

  - 커서 페이지네이션은 공용 유틸(buildCursorArgs)을 쓴다.
  - 정렬은 오름차순이므로 tie-break 인 id 도 오름차순으로 맞춘다.
  - 목록에 필요한 정보만 담는다. 기사님 통계(attachMoverStats)는 필요 없다.
  */
  async findReceivedByMoverId(
    moverId: string,
    where: Prisma.EstimateRequestWhereInput,
    { sortBy, cursor, size }: ReceivedListParams
  ): Promise<ReceivedRequestRow[]> {
    return prisma.estimateRequest.findMany({
      where,
      orderBy: [{ [sortBy]: 'asc' }, { id: 'asc' }],
      ...buildCursorArgs(cursor, size),
      select: receivedRequestSelect(moverId),
    });
  },

  /** 필터를 만족하는 전체 건수 (목록과 독립이라 별도 쿼리로 센다) */
  async countReceived(where: Prisma.EstimateRequestWhereInput) {
    return prisma.estimateRequest.count({ where });
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
