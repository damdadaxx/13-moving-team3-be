import { z } from 'zod';
import { Region, ServiceType } from '../../generated/prisma/client';
import { pageSizeSchema } from '../../utils/paginationSchema';

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

/*=================================================
GET /estimate-requests/received — 기사님이 받은 요청 목록
=================================================*/

/*
@ 정렬
- moveDate  : 이사일자 빠른 순 (오늘과 가까운 이사부터)
- createdAt : 요청일이 빠른 순 (먼저 들어온 요청부터)
- 둘 다 오름차순이며, 고유값인 id를 tie-break로 함께 정렬해야
  커서 페이지네이션이 동률에서도 흔들리지 않는다.

@ 주의사항
- 정렬 기준이나 필터가 바뀌면 기존 cursor는 무효다. 첫 페이지부터 다시 요청해야 한다.
*/
export const receivedSortBySchema = z
  .enum(['moveDate', 'createdAt'], {
    error: 'sortBy는 moveDate 또는 createdAt이어야 합니다.',
  })
  .default('moveDate');

/*
@ 목록 필터 (regions / serviceTypes)

- 목록을 좁히는 필터다. 지정 견적을 포함해 모든 결과에 걸린다.
- 쿼리스트링은 `?regions=SEOUL,GYEONGGI` 와 `?regions=SEOUL&regions=GYEONGGI` 둘 다 받는다.
- 프로필 밖의 값을 넣어도 지정이 아닌 요청은 자격(서비스·지역 매칭)에서 걸리므로
  서비스 범위를 넘겨볼 수 없다. 나에게 온 지정 견적만 보이는 것은 정상이다.
*/
const splitCsv = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.flatMap((v) => String(v).split(','));
  if (typeof value === 'string') return value.split(',');
  return value;
};

// 중복을 제거해 where 절의 in 배열이 불필요하게 길어지지 않게 한다.
const dedupe = <T>(values: T[]) => [...new Set(values)];

const regionsFilterSchema = z.preprocess(
  splitCsv,
  z
    .array(z.enum(Region, { error: '유효하지 않은 지역입니다.' }))
    .min(1, '지역을 한 개 이상 선택해 주세요.')
    .transform(dedupe)
);

const serviceTypesFilterSchema = z.preprocess(
  splitCsv,
  z
    .array(
      z.enum(ServiceType, {
        error:
          'serviceTypes는 SMALL_MOVE, HOME_MOVE, OFFICE_MOVE 중에서 선택해 주세요.',
      })
    )
    .min(1, '제공 서비스를 한 개 이상 선택해 주세요.')
    .transform(dedupe)
);

/*
@ keyword — 고객 이름 부분 검색

- 빈 문자열(`?keyword=`)은 "검색 안 함"으로 본다.
  프론트가 검색창을 비웠을 때 빈 값을 그대로 보내도 400이 나지 않게 하기 위함이다.
- 이름 최대 길이(20자)를 넘는 검색어는 매칭될 수 없으므로 막는다.
*/
const keywordSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().max(20, '검색어는 20자 이하여야 합니다.').optional());

export const receivedRequestsQuerySchema = z.object({
  sortBy: receivedSortBySchema,
  // 고객 이름 부분 검색 (대소문자 무시)
  keyword: keywordSchema,
  // 지정 견적 요청만(true) / 지정이 아닌 요청만(false). 생략하면 전체.
  isDesignated: z
    .enum(['true', 'false'], {
      error: 'isDesignated는 true 또는 false여야 합니다.',
    })
    .transform((value) => value === 'true')
    .optional(),
  regions: regionsFilterSchema.optional(),
  serviceTypes: serviceTypesFilterSchema.optional(),
  cursor: z.uuid('cursor 형식이 올바르지 않습니다.').optional(),
  size: pageSizeSchema(),
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
export type ReceivedRequestsQuery = z.infer<typeof receivedRequestsQuerySchema>;
export type CreateDesignatedEstimateBody = z.infer<
  typeof createDesignatedEstimateSchema
>;
