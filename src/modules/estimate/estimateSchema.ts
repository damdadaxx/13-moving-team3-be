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
  cursor: z.string().uuid().optional(),
  size: z.coerce.number().int().positive().optional().default(10),
});

export type GetEstimatesQueryDto = z.infer<typeof getEstimatesQuerySchema>;

export const getEstimateDetailParamsSchema = z.object({
  estimateId: z.string().uuid(),
});

export type GetEstimateDetailParamsDto = z.infer<
  typeof getEstimateDetailParamsSchema
>;
