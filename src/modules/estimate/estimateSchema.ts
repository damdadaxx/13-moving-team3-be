import { z } from 'zod';
import { EstimateStatus, ServiceType } from '../../generated/prisma/client';
import { pageSizeSchema } from '../../utils/paginationSchema';

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
    { message: '견적 상태 값이 올바르지 않습니다.' }
  )
  .optional();

export const getEstimatesQuerySchema = z.object({
  status: statusQuerySchema,
  serviceType: z.enum(ServiceType).optional(),
  // 무한 스크롤 커서 — 직전 응답의 nextCursor(마지막 estimateRequestId)를 그대로 넘긴다.
  cursor: z.uuid().optional(),
  size: pageSizeSchema(),
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
  status: z.literal('PROPOSED', '견적 상태 값이 올바르지 않습니다.'),
  price: z
    .number('견적 금액을 입력해 주세요.')
    .int('견적 금액은 정수여야 합니다.')
    .positive('견적 금액은 1 이상이어야 합니다.'),
  comment: z
    .string('견적 코멘트를 입력해 주세요.')
    .min(10, '견적 코멘트는 10자 이상 입력해 주세요.'),
});

export const rejectEstimateSchema = z.object({
  status: z.literal('REJECTED', '견적 상태 값이 올바르지 않습니다.'),
  rejectReason: z
    .string('반려 사유를 입력해 주세요.')
    .min(10, '반려 사유는 10자 이상 입력해 주세요.'),
});

export const acceptEstimateSchema = z.object({
  status: z.literal('ACCEPTED', '견적 상태 값이 올바르지 않습니다.'),
});

export type ProposeEstimateInput = z.infer<typeof proposeEstimateSchema>;
export type RejectEstimateInput = z.infer<typeof rejectEstimateSchema>;
export type AcceptEstimateInput = z.infer<typeof acceptEstimateSchema>;

// POST /estimates — 기사님이 지정 없이(PENDING 상태의 열린 요청에) 견적을 새로 보낸다.
export const createEstimateSchema = z.object({
  estimateRequestId: z.uuid('견적 요청 ID 형식이 올바르지 않습니다.'),
  price: z
    .number('견적 금액을 입력해 주세요.')
    .int('견적 금액은 정수여야 합니다.')
    .positive('견적 금액은 1 이상이어야 합니다.'),
  comment: z
    .string('견적 코멘트를 입력해 주세요.')
    .min(10, '견적 코멘트는 10자 이상 입력해 주세요.'),
});

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
