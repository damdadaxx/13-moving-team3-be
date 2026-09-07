import { Router } from 'express';
import { validate } from '../../middlewares/validation';
import { mockAuth } from '../../middlewares/mockAuth';
import * as estimateController from './estimateController';
import { getEstimatesQuerySchema } from './estimateDto';

const router = Router();

// TODO: 인증 미들웨어(authenticate)가 준비되면 mockAuth를 authenticate로 교체해야 합니다.
// TODO: POST /estimate-request, GET /estimates/:estimateId, PATCH /estimates/:estimateId 는 스펙 확정 후 추가합니다.
router.get(
  '/estimates',
  mockAuth,
  validate(getEstimatesQuerySchema, 'query'),
  estimateController.getEstimates
);

export default router;
