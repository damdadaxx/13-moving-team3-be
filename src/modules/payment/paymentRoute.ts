import { Router } from 'express';
import { validate } from '../../middlewares/validation';
import { authenticate } from '../../middlewares/authenticate';
import { paymentController } from './paymentController';
import {
  confirmPaymentSchema,
  getPaymentHistoryQuerySchema,
  paymentParamsSchema,
} from './paymentSchema';

const router = Router();

// 경로가 /estimates/:estimateId/payments 와 /payments/confirm 두 갈래라서
// app.ts에서 프리픽스 없이 마운트하고 전체 경로를 여기서 적는다.
// 결제내역 (고객 본인의 결제 목록)
router.get(
  '/payments',
  authenticate,
  validate(getPaymentHistoryQuerySchema, 'query'),
  paymentController.getPaymentHistory
);

router.get(
  '/estimates/:estimateId/payments',
  authenticate,
  validate(paymentParamsSchema, 'params'),
  paymentController.getPayments
);

router.post(
  '/estimates/:estimateId/payments',
  authenticate,
  validate(paymentParamsSchema, 'params'),
  paymentController.createPayment
);

router.post(
  '/payments/confirm',
  authenticate,
  validate(confirmPaymentSchema),
  paymentController.confirmPayment
);

export default router;
