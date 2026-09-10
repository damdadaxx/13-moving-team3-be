import { z } from 'zod';
import { Region, ServiceType } from '../../generated/prisma/client';
/*=================================================
multipart/form-data 배열 변환
=================================================*/

/*
@ parseFormDataArray

- FormData로 전송된 배열 문자열을 실제 배열로 변환합니다.
- 프론트에서는 배열을 JSON.stringify()해서 전달합니다.

@ 요청 예시
- serviceTypes: '["SMALL_MOVE","HOME_MOVE"]'
- serviceRegions: '["SEOUL","GYEONGGI"]'

@ 주의사항
- JSON 파싱에 실패하면 원래 값을 그대로 반환합니다.
- 이후 Zod 배열 검증이 실패하면서 errorHandler로 전달됩니다.
*/
const parseFormDataArray = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

/*=================================================
multipart/form-data Boolean 변환
=================================================*/

/*
@ parseFormDataBoolean

- FormData의 'true', 'false' 문자열을 Boolean으로 변환합니다.
*/
const parseFormDataBoolean = (value: unknown): unknown => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
};

const serviceTypesSchema = z.preprocess(
  parseFormDataArray,
  z
    .array(z.enum(ServiceType))
    .min(1, '제공 서비스를 한 개 이상 선택해 주세요.')
    .refine(
      (serviceTypes) => new Set(serviceTypes).size === serviceTypes.length,
      { message: '동일한 제공 서비스를 중복해서 선택할 수 없습니다.' }
    )
);

const serviceRegionsSchema = z.preprocess(
  parseFormDataArray,
  z
    .array(z.enum(Region))
    .min(1, '서비스 가능 지역을 한 개 이상 선택해 주세요.')
    .refine(
      (serviceRegions) =>
        new Set(serviceRegions).size === serviceRegions.length,
      { message: '동일한 서비스 지역을 중복해서 선택할 수 없습니다.' }
    )
);

/*=================================================
기사님 프로필 등록 요청 스키마
=================================================*/

/*
@ createMoverProfileSchema

- POST /mover/profile의 body를 검증합니다.
- careerMonths는 FormData에서 문자열로 들어오므로 숫자로 변환합니다.
- 이미지는 Multer에서 따로 검증하므로 이 스키마에 포함하지 않습니다.
*/
export const createMoverProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, '별명을 입력해 주세요.')
    .max(10, '별명은 최대 10자까지 입력할 수 있습니다.'),
  careerMonths: z.coerce
    .number()
    .int('경력은 정수로 입력해 주세요.')
    .min(0, '경력은 0개월 이상이어야 합니다.'),

  shortIntro: z
    .string()
    .trim()
    .min(8, '한 줄 소개는 8자 이상 입력해 주세요.')
    .max(50, '한 줄 소개는 최대 50자까지 입력할 수 있습니다.'),
  description: z
    .string()
    .trim()
    .min(10, '상세 설명은 10자 이상 입력해 주세요.')
    .max(300, '상세 설명은 최대 300자까지 입력할 수 있습니다.'),
  serviceTypes: serviceTypesSchema,
  serviceRegions: serviceRegionsSchema,
});

/*=================================================
기사님 프로필 수정 요청 스키마
=================================================*/

/*
@ updateMoverProfileSchema

- PATCH 요청이므로 모든 프로필 필드는 선택 사항입니다.
- 실제 수정할 값이 있는지는 이미지까지 확인해야 하므로
  service에서 최종 검사합니다.
*/
export const updateMoverProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, '별명을 입력해 주세요.')
    .max(10, '별명은 최대 10자까지 입력할 수 있습니다.')
    .optional(),
  careerMonths: z.coerce
    .number()
    .int('경력은 정수로 입력해 주세요.')
    .min(0, '경력은 0개월 이상이어야 합니다.')
    .optional(),
  shortIntro: z
    .string()
    .trim()
    .min(8, '한 줄 소개는 8자 이상 입력해 주세요.')
    .max(50, '한 줄 소개는 최대 50자까지 입력할 수 있습니다.')
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, '상세 설명은 10자 이상 입력해 주세요.')
    .max(300, '상세 설명은 최대 300자까지 입력할 수 있습니다.')
    .optional(),
  serviceTypes: serviceTypesSchema.optional(),
  serviceRegions: serviceRegionsSchema.optional(),
  removeImage: z.preprocess(parseFormDataBoolean, z.boolean()).optional(),
});

/*=================================================
기사님 목록 조회 쿼리 스키마
=================================================*/

/*
@ getMoverListQuerySchema

- GET /mover 목록 조회에 사용하는 쿼리를 검증합니다.
- 첫 번째 요청에는 cursor를 보내지 않습니다.
- 다음 요청부터 직전 응답의 nextCursor를 cursor로 전달합니다.
- size는 한 번에 조회할 기사님 수이며 기본값은 10입니다.

@ 주의사항

- 검색어, 지역, 서비스 종류 또는 정렬 기준이 변경되면
  기존 cursor를 사용하지 않고 첫 페이지부터 다시 요청해야 합니다.
*/
export const getMoverListQuerySchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  region: z.enum(Region).optional(),
  serviceType: z.enum(ServiceType).optional(),
  sortBy: z
    .enum(['reviewCount', 'rating', 'career', 'confirmedCount'])
    .default('reviewCount'),

  /*
  @ cursor

  - 직전 응답의 data.nextCursor를 그대로 전달합니다.
  - MoverProfile의 userId는 UUID 기본키이므로 UUID 형식을 검증합니다.
  */
  cursor: z.uuid('올바른 커서 값이 아닙니다.').optional(),

  /*
  @ size

  - 한 번의 요청에서 반환할 기사님 수입니다.
  - Repository에서는 다음 페이지 존재 여부를 확인하기 위해
    실제로 size보다 한 건 더 조회합니다.
  */
  size: z.coerce
    .number()
    .int('size는 정수여야 합니다.')
    .min(1, 'size는 1 이상이어야 합니다.')
    .max(100, 'size는 최대 100까지 입력할 수 있습니다.')
    .default(10),
});

/*=================================================
기사님 상세 조회 경로 스키마
=================================================*/

export const getMoverParamsSchema = z.object({
  id: z.uuid('올바른 기사님 ID가 아닙니다.'),
});

/*=================================================
Mover 요청 타입
=================================================*/

/*
@ 요청 DTO 타입

- Zod 스키마와 타입을 따로 중복해서 작성하지 않습니다.
- Zod가 검증한 결과와 TypeScript 타입이 항상 일치하게 됩니다.
*/
export type CreateMoverProfileInput = z.infer<typeof createMoverProfileSchema>;

export type UpdateMoverProfileInput = z.infer<typeof updateMoverProfileSchema>;

export type GetMoverListQuery = z.infer<typeof getMoverListQuerySchema>;

export type GetMoverParams = z.infer<typeof getMoverParamsSchema>;
