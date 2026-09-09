import { Prisma } from '../../generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import {
  estimateRequestRepository,
  type CreateEstimateRequestInput,
} from './estimateRequestRepository';

/** 목록 조회 시 허용하는 최대 페이지 크기 */
const MAX_LIMIT = 50;

// customerId는 인증 정보에서 채우므로 클라이언트 입력에서 제외합니다.
type CreateInput = Omit<CreateEstimateRequestInput, 'customerId'>;

type ListParams = {
  cursor?: string;
  limit?: number;
};

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

export const estimateRequestService = {
  /**
   * 진행 중인 견적 요청과 받은 견적 목록을 조회합니다.
   * 진행 중인 요청이 없는 것은 정상 상태이므로 null을 반환합니다.
   */
  async getActive(customerId: string) {
    return estimateRequestRepository.findActiveByCustomerId(customerId);
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
      // 지정 견적 3건 상한 초과 시 repository가 ConflictError를 던집니다.
      return await estimateRequestRepository.createDirectEstimateRequest({
        estimateRequestId,
        moverId,
      });
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

  /** 이사일이 지난 요청 일괄 정리 (스케줄러용) */
  async closePastEstimateRequests(now?: Date) {
    return estimateRequestRepository.closePastEstimateRequests(now);
  },
};
