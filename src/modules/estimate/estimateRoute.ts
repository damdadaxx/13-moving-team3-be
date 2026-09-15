import { Router } from 'express';
import { validate } from '../../middlewares/validation';
import { authenticate } from '../../middlewares/authenticate';
import { estimateController } from './estimateController';
import {
  createEstimateSchema,
  getEstimateDetailParamsSchema,
  getEstimatesQuerySchema,
} from './estimateSchema';

const router = Router();

// app.ts에서 '/estimates' 프리픽스로 마운트한다.

// 기사님이 지정 없이 견적을 새로 보낸다. (MOVER 역할 확인은 서비스에서 한다)
router.post(
  '/',
  authenticate,
  validate(createEstimateSchema),
  estimateController.createEstimate
);

router.get(
  '/',
  authenticate,
  validate(getEstimatesQuerySchema, 'query'),
  estimateController.getEstimates
);

router.get(
  '/:estimateId',
  authenticate,
  validate(getEstimateDetailParamsSchema, 'params'),
  estimateController.getEstimateDetail
);

// body는 status별로 필요한 필드가 달라서 validate() 대신 서비스에서 직접 검증한다.
router.patch(
  '/:estimateId',
  authenticate,
  validate(getEstimateDetailParamsSchema, 'params'),
  estimateController.updateEstimateStatus
);

export default router;
