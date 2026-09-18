import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import {
  estimateRequestRepository,
  type CreateEstimateRequestInput,
  type ReceivedRequestRow,
} from './estimateRequestRepository';
import { paginateByCursor } from '../../utils/cursorPagination';
import type { ReceivedRequestsQuery } from './estimateRequestSchema';
import notificationService from '../notification/notificationService';
import notificationMessage from '../notification/notificationMessage';

/** 목록 조회 시 허용하는 최대 페이지 크기 */
const MAX_LIMIT = 50;

// customerId는 인증 정보에서 채우므로 클라이언트 입력에서 제외합니다.
type CreateInput = Omit<CreateEstimateRequestInput, 'customerId'>;

type ListParams = {
  cursor?: string;
  limit?: number;
};

type ActiveEstimateRequest = NonNullable<
  Awaited<ReturnType<typeof estimateRequestRepository.findActiveByCustomerId>>
>;

/*
@ toReceivedListItem

- 받은 요청 카드 한 장의 응답 모양으로 바꾼다.
- estimates 는 "나에게 지정된 견적" 만 걸러 담겨 있으므로, 배열이 비었는지로
  지정 견적 여부를 판단하고 원본 배열은 응답에서 뺀다.
- 지정 견적이면 estimateId도 함께 내려준다 — 프론트가 "견적 보내기"에서
  PATCH /estimates/:estimateId(status: PROPOSED)를 호출하려면 이 id가 있어야 한다.
  지정이 아니면 null이고, 그때는 POST /estimates(estimateRequestId)로 보낸다.
*/
const toReceivedListItem = (row: ReceivedRequestRow) => ({
  estimateRequestId: row.id,
  estimateId: row.estimates[0]?.id ?? null,
  serviceType: row.serviceType,
  moveDate: row.moveDate,
  departureAddress: row.departureAddress,
  arrivalAddress: row.arrivalAddress,
  requestedAt: row.createdAt,
  isDesignated: row.estimates.length > 0,
  customer: {
    customerId: row.customer.userId,
    name: row.customer.user.name,
    region: row.customer.region,
  },
});

/** 유니크 제약 위반(P2002) 여부 */
function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** 외래 키 제약 위반(P2003) 여부 — 참조 대상이 존재하지 않을 때 */
function isForeignKeyViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

/** CONFIRMED 요청의 이사일이 오늘/내일이면 MOVE_DAY 알림을 한 번씩 생성 */
const notifyMoveDayIfDue = async (active: ActiveEstimateRequest) => {
  if (active.status !== 'CONFIRMED') return;

  const relativeDay = notificationMessage.relativeMoveDay(active.moveDate);
  if (!relativeDay) return;

  const accepted = active.estimates.find(
    (estimate) => estimate.status === 'ACCEPTED'
  );
  if (!accepted) return;

  const targetPath = accepted.id;
  const content = notificationMessage.moveDay(
    relativeDay,
    notificationMessage.toMoveDayPlace(active.departureAddress),
    notificationMessage.toMoveDayPlace(active.arrivalAddress)
  );
  const recipients = [active.customerId, accepted.mover.userId];

  // 이사 예정일 알림 생성
  const notifications = await prisma.$transaction(async (tx) => {
    const created: Awaited<ReturnType<typeof notificationService.create>>[] =
      [];
    for (const userId of recipients) {
      const exists = await notificationService.hasNotification(
        { userId, type: 'MOVE_DAY', targetPath },
        tx
      );

      if (exists) continue;

      created.push(
        await notificationService.create(
          { userId, type: 'MOVE_DAY', content, targetPath },
          tx
        )
      );
    }
    return created;
  });

  await notificationService.publishCreated(notifications);
};

export const estimateRequestService = {
  /**
   * 진행 중인 견적 요청과 받은 견적 목록을 조회합니다.
   * 진행 중인 요청이 없는 것은 정상 상태이므로 null을 반환합니다.
   * CONFIRMED 요청의 이사일이 오늘/내일이면 MOVE_DAY 알림을 한 번씩 생성합니다.
   */
  async getActive(customerId: string) {
    const active =
      await estimateRequestRepository.findActiveByCustomerId(customerId);

    // CONFIRMED 요청의 이사일이 오늘/내일이면 MOVE_DAY 알림을 한 번씩 생성
    if (active) {
      await notifyMoveDayIfDue(active);
    }
    return active;
  },

  /** 이사 이력 목록 (커서 기반 무한 스크롤) */
  async getHistory(customerId: string, { cursor, limit }: ListParams = {}) {
    // 클라이언트가 과도한 limit을 보내지 못하도록 상한을 둡니다.
    const safeLimit =
      limit === undefined ? undefined : Math.min(Math.max(limit, 1), MAX_LIMIT);

    return estimateRequestRepository.findByEstimateUserId(customerId, {
      cursor,
      limit: safeLimit,
    });
  },

  /**
   * 견적 요청을 생성합니다.
   * 이미 진행 중인 요청이 있으면 부분 유니크 인덱스에 걸려 409로 응답합니다.
   */
  async create(customerId: string, input: CreateInput) {
    if (new Date(input.moveDate) <= new Date()) {
      throw new BadRequestError('이사일은 오늘 이후로 선택해 주세요.');
    }

    try {
      return await estimateRequestRepository.createEstimateRequest({
        ...input,
        customerId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('이미 진행 중인 견적 요청이 있습니다.');
      }
      throw error;
    }
  },

  /**
   * 특정 기사님에게 지정 견적을 요청합니다.
   * 본인의 진행 중인 요청에만, 확정 전(PENDING)일 때만 보낼 수 있습니다.
   */
  async createDesignated(
    customerId: string,
    estimateRequestId: string,
    moverId: string
  ) {
    const active =
      await estimateRequestRepository.findActiveByCustomerId(customerId);

    if (!active) {
      throw new NotFoundError('진행 중인 견적 요청이 없습니다.');
    }

    // 본인의 활성 요청이 아닌 id로 요청한 경우
    if (active.id !== estimateRequestId) {
      throw new ForbiddenError('본인의 견적 요청에만 접근할 수 있습니다.');
    }

    if (active.status !== 'PENDING') {
      throw new BadRequestError(
        '이미 견적을 확정한 요청에는 지정 견적을 요청할 수 없습니다.'
      );
    }

    try {
      // 지정 견적 요청 시 알림 생성
      const { estimate, notifications } = await prisma.$transaction(
        async (tx) => {
          // 지정 견적 요청 생성
          const estimate =
            await estimateRequestRepository.createDirectEstimateRequest(
              { estimateRequestId, moverId },
              tx
            );

          // 고객 정보 조회
          const customer = await tx.user.findUniqueOrThrow({
            where: { id: customerId },
            select: { name: true },
          });

          // 새로운 견적 요청 알림 생성
          const notification = await notificationService.create(
            {
              userId: moverId,
              type: 'NEW_REQUEST',
              content: notificationMessage.newRequest(
                customer.name,
                active.serviceType
              ),
            },
            tx
          );

          return { estimate, notifications: [notification] };
        }
      );

      await notificationService.publishCreated(notifications);
      return estimate;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('이미 지정 견적을 요청한 기사님입니다.');
      }
      // moverId가 기사님 프로필에 없는 경우(존재하지 않는 id, 일반 유저 id 등)
      if (isForeignKeyViolation(error)) {
        throw new NotFoundError('해당 기사님을 찾을 수 없습니다.');
      }
      throw error;
    }
  },

  /*
  @ getReceivedRequests — 기사님이 받은 요청 목록

  - 기사님 프로필이 없으면 조회할 범위 자체가 없으므로 404 로 안내한다.
  - 프로필 값(자격)과 쿼리 필터는 역할이 달라 섞지 않고 각각 repository 로 넘긴다.
    자격은 "지정이 아닌 요청을 볼 수 있는가", 필터는 "지금 무엇을 보고 싶은가"다.
  */
  async getReceivedRequests(moverId: string, query: ReceivedRequestsQuery) {
    const scope =
      await estimateRequestRepository.findMoverServiceScope(moverId);

    if (!scope) {
      throw new NotFoundError('기사님 프로필을 먼저 등록해 주세요.');
    }

    /*
    @ 프로필 값과 쿼리 필터를 섞지 않는다

    - 프로필 값(자격)은 그대로 넘긴다. 교집합을 내지 않는다.
      교집합을 내면 필터 값에 따라 배열이 비고, 그때만 결과가 통째로 달라져
      같은 필터가 값에 따라 다르게 동작하게 된다.
    - 쿼리 필터는 repository 가 AND 로 붙인다. 지정 견적에도 똑같이 걸린다.
    - 프로필이 비어 있어도 matchesServiceArea 가 아무것도 매칭하지 않을 뿐이고,
      나에게 온 지정 견적은 정상적으로 조회된다. 그래서 조기 반환이 필요 없다.
    */
    const where = estimateRequestRepository.buildReceivedWhere({
      moverId,
      profileServiceTypes: scope.serviceTypes.map((row) => row.serviceType),
      profileRegions: scope.serviceRegions.map((row) => row.region),
      filterServiceTypes: query.serviceTypes,
      filterRegions: query.regions,
      isDesignated: query.isDesignated,
      keyword: query.keyword,
    });

    // 목록과 전체 건수는 서로 독립이라 동시에 조회한다.
    const [rows, totalCount] = await Promise.all([
      estimateRequestRepository.findReceivedByMoverId(moverId, where, {
        sortBy: query.sortBy,
        cursor: query.cursor,
        size: query.size,
      }),
      estimateRequestRepository.countReceived(where),
    ]);

    const { items, nextCursor } = paginateByCursor(rows, query.size);

    return {
      list: items.map(toReceivedListItem),
      nextCursor,
      totalCount,
    };
  },

  /** 이사일이 지난 요청 일괄 정리 (스케줄러용) */
  async closePastEstimateRequests(now?: Date) {
    return estimateRequestRepository.closePastEstimateRequests(now);
  },
};
