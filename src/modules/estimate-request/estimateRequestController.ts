import { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../utils/error';
import { estimateRequestService } from './estimateRequestService';
import type {
  CreateDesignatedEstimateBody,
  CreateEstimateRequestBody,
  HistoryQuery,
} from './estimateRequestSchema';

// auth 모듈과 동일한 응답 형식
const success = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

// validate 미들웨어가 검증해 넣어둔 값
const getValidated = <T>(req: Request) => req.validatedData as T;

/**
 * 인증 payload에서 고객 id를 꺼낸다.
 * 토큰 자체의 검증은 authenticate 미들웨어가 이미 끝냈고,
 * 여기서는 일반 유저(CUSTOMER) 전용 엔드포인트임을 보장한다.
 */
const getCustomerId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  if (req.auth?.role !== 'CUSTOMER') {
    throw new ForbiddenError('일반 유저만 이용할 수 있는 기능입니다.');
  }
  return userId;
};

/** POST / - 견적 요청 생성 */
export const create = async (req: Request, res: Response) => {
  const input = getValidated<CreateEstimateRequestBody>(req);
  const estimateRequest = await estimateRequestService.create(
    getCustomerId(req),
    input
  );
  success(res, estimateRequest, 201);
};

/** GET /active - 진행 중인 견적 요청과 받은 견적 목록 (없으면 null) */
export const getActive = async (req: Request, res: Response) => {
  const estimateRequest = await estimateRequestService.getActive(
    getCustomerId(req)
  );
  success(res, estimateRequest);
};

/** GET /history - 이사 이력 목록 (커서 기반 무한 스크롤) */
export const getHistory = async (req: Request, res: Response) => {
  const { cursor, limit } = getValidated<HistoryQuery>(req);
  const history = await estimateRequestService.getHistory(getCustomerId(req), {
    cursor,
    limit,
  });
  success(res, history);
};

/** POST /:estimateRequestId/estimates - 특정 기사님에게 지정 견적 요청 */
export const createDesignated = async (req: Request, res: Response) => {
  // 경로 파라미터는 라우터의 validate(params)에서 이미 uuid 검증을 마쳤습니다.
  const { estimateRequestId } = req.params as { estimateRequestId: string };
  const { moverId } = getValidated<CreateDesignatedEstimateBody>(req);

  const estimate = await estimateRequestService.createDesignated(
    getCustomerId(req),
    estimateRequestId,
    moverId
  );

  success(res, estimate, 201);
};
