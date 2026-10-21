import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import { paymentService } from './paymentService';
import {
  createPaymentBodySchema,
  type ConfirmPaymentDto,
  type PaymentParamsDto,
} from './paymentSchema';

export const paymentController = {
  getPayments: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as PaymentParamsDto;
    const result = await paymentService.getPayments(
      req.auth.sub,
      req.auth.role,
      estimateId
    );

    res.status(200).json({ success: true, data: result });
  },

  createPayment: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as PaymentParamsDto;
    // 경로 파라미터는 validate() 로 검증했으므로 body 는 여기서 따로 검증한다
    const body = createPaymentBodySchema.parse(req.body);
    const result = await paymentService.createOrder(
      req.auth.sub,
      req.auth.role,
      estimateId,
      body
    );

    res.status(200).json({ success: true, data: result });
  },

  confirmPayment: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const input = req.validatedData as ConfirmPaymentDto;
    const result = await paymentService.confirm(
      req.auth.sub,
      req.auth.role,
      input
    );

    res.status(200).json({ success: true, data: result });
  },
};
