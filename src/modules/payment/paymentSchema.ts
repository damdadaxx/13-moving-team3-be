import { z } from 'zod';
import { PaymentType } from '../../generated/prisma/client';

export const paymentParamsSchema = z.object({
  estimateId: z.uuid(),
});
export type PaymentParamsDto = z.infer<typeof paymentParamsSchema>;

export const createPaymentBodySchema = z.object({
  type: z.enum(PaymentType),
});
export type CreatePaymentBodyDto = z.infer<typeof createPaymentBodySchema>;

// 토스 주문번호 규칙: 6~64자, 영문 대소문자·숫자·-·_
export const confirmPaymentSchema = z.object({
  paymentKey: z.string().min(1).max(200),
  orderId: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  amount: z.number().int().positive(),
});
export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>;
