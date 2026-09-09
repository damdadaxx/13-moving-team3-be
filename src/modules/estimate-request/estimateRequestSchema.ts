import { z } from 'zod';

const serviceTypeSchema = z.enum(['SMALL_MOVE', 'HOME_MOVE', 'OFFICE_MOVE'], {
  error: 'serviceType은 SMALL_MOVE, HOME_MOVE, OFFICE_MOVE 중 하나여야 합니다.',
});

// 이사일은 미래만 허용. service에서도 한 번 더 확인합니다.
const moveDateSchema = z.coerce
  .date('moveDate는 올바른 날짜 형식이어야 합니다.')
  .refine((date) => date.getTime() > Date.now(), {
    error: '이사일은 오늘 이후로 선택해 주세요.',
  });

// 우편번호는 5자리 문자열로 받습니다.
// "04524"처럼 0으로 시작하는 번호를 그대로 보존하기 위함입니다.
const zipCodeSchema = (field: string) =>
  z
    .string(`${field}는 필수 값입니다.`)
    .trim()
    .regex(/^\d{5}$/, `${field}는 5자리 숫자 문자열이어야 합니다.`);

const addressSchema = (field: string) =>
  z
    .string(`${field}는 필수 값입니다.`)
    .trim()
    .min(5, `${field}는 5자 이상이어야 합니다.`)
    .max(200, `${field}는 200자 이하여야 합니다.`);

/** POST /estimate-requests */
export const createEstimateRequestSchema = z.object(
  {
    serviceType: serviceTypeSchema,
    moveDate: moveDateSchema,
    departureZipCode: zipCodeSchema('departureZipCode'),
    departureAddress: addressSchema('departureAddress'),
    arrivalZipCode: zipCodeSchema('arrivalZipCode'),
    arrivalAddress: addressSchema('arrivalAddress'),
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

/** GET /estimate-requests/history 의 쿼리스트링 */
export const historyQuerySchema = z.object({
  // 직전 페이지 마지막 요청의 id
  cursor: z.uuid('cursor 형식이 올바르지 않습니다.').optional(),
  // 쿼리스트링은 문자열로 들어오므로 숫자로 변환합니다.
  limit: z.coerce
    .number('limit은 숫자여야 합니다.')
    .int('limit은 정수여야 합니다.')
    .min(1, 'limit은 1 이상이어야 합니다.')
    .max(50, 'limit은 50 이하여야 합니다.')
    .optional(),
});

/** POST /estimate-requests/:estimateRequestId/estimates 의 경로 파라미터 */
export const estimateRequestIdParamSchema = z.object({
  estimateRequestId: z.uuid('estimateRequestId 형식이 올바르지 않습니다.'),
});

/** POST /estimate-requests/:estimateRequestId/estimates 의 본문 */
export const createDesignatedEstimateSchema = z.object(
  {
    moverId: z.uuid('moverId 형식이 올바르지 않습니다.'),
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export type CreateEstimateRequestBody = z.infer<
  typeof createEstimateRequestSchema
>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type CreateDesignatedEstimateBody = z.infer<
  typeof createDesignatedEstimateSchema
>;
