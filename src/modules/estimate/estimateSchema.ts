import { z } from 'zod';
import { EstimateStatus, ServiceType } from '../../generated/prisma/client';

const ESTIMATE_STATUS_VALUES = Object.values(EstimateStatus);

// EstimateStatus 값(콤마로 여러 개 나열 가능) 또는 'closed'
const statusQuerySchema = z
  .string()
  .refine(
    (value) =>
      value === 'closed' ||
      value
        .split(',')
        .every((status) =>
          ESTIMATE_STATUS_VALUES.includes(status as EstimateStatus)
        ),
    { message: 'status 값이 올바르지 않습니다.' }
  )
  .optional();

export const getEstimatesQuerySchema = z.object({
  status: statusQuerySchema,
  serviceType: z.enum(ServiceType).optional(),
  // 무한 스크롤 커서 — 직전 응답의 nextCursor(마지막 estimateRequestId)를 그대로 넘긴다.
  cursor: z.uuid().optional(),
  size: z.coerce.number().int().positive().optional().default(10),
});

export type GetEstimatesQueryDto = z.infer<typeof getEstimatesQuerySchema>;

export const getEstimateDetailParamsSchema = z.object({
  estimateId: z.uuid(),
});

export type GetEstimateDetailParamsDto = z.infer<
  typeof getEstimateDetailParamsSchema
>;

// PATCH /estimates/:estimateId — status별로 요구되는 나머지 필드가 달라서 개별 스키마로 둔다.
// status 자체가 셋 중 하나인지는 서비스에서 먼저 확인해 INVALID_STATUS로 분리 응답한다.
export const proposeEstimateSchema = z.object({
  status: z.literal('PROPOSED'),
  price: z.number().int().positive('price는 양의 정수여야 합니다.'),
  comment: z.string().min(10, 'comment은 10자 이상이어야 합니다.'),
});

export const rejectEstimateSchema = z.object({
  status: z.literal('REJECTED'),
  rejectReason: z.string().min(10, 'rejectReason은 10자 이상이어야 합니다.'),
});

export const acceptEstimateSchema = z.object({
  status: z.literal('ACCEPTED'),
});

export type ProposeEstimateInput = z.infer<typeof proposeEstimateSchema>;
export type RejectEstimateInput = z.infer<typeof rejectEstimateSchema>;
export type AcceptEstimateInput = z.infer<typeof acceptEstimateSchema>;
