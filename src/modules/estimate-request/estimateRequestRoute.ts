import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import * as estimateRequestController from './estimateRequestController';
import {
  createDesignatedEstimateSchema,
  createEstimateRequestSchema,
  estimateRequestIdParamSchema,
  historyQuerySchema,
} from './estimateRequestSchema';

const estimateRequestRouter = Router();

// 모든 엔드포인트가 로그인한 고객 기준으로 동작하므로 라우터 전체에 적용한다.
// (CUSTOMER 역할 확인은 컨트롤러의 getCustomerId 에서 한다.)
estimateRequestRouter.use(authenticate);

// 견적 요청 생성
estimateRequestRouter.post(
  '/',
  validate(createEstimateRequestSchema),
  estimateRequestController.create
);

// 진행 중인 견적 요청 + 받은 견적 목록
// 고객당 진행 중인 요청은 최대 1건이라 id를 경로에 두지 않는다.
estimateRequestRouter.get('/active', estimateRequestController.getActive);

// 이사 이력 목록 (커서 기반 무한 스크롤) - ?cursor=&limit=
estimateRequestRouter.get(
  '/history',
  validate(historyQuerySchema, 'query'),
  estimateRequestController.getHistory
);

// 특정 기사님에게 지정 견적 요청
// params를 먼저 검증하고 body를 나중에 검증한다.
// validate는 req.validatedData를 덮어쓰므로, 컨트롤러가 쓸 body가 마지막이어야 한다.
estimateRequestRouter.post(
  '/:estimateRequestId/estimates',
  validate(estimateRequestIdParamSchema, 'params'),
  validate(createDesignatedEstimateSchema),
  estimateRequestController.createDesignated
);

export default estimateRequestRouter;
