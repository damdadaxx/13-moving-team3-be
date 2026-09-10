import { z } from 'zod';

const REGIONS = [
  'SEOUL',
  'GYEONGGI',
  'INCHEON',
  'GANGWON',
  'CHUNGBUK',
  'CHUNGNAM',
  'SEJONG',
  'DAEJEON',
  'JEONBUK',
  'JEONNAM',
  'GWANGJU',
  'GYEONGBUK',
  'GYEONGNAM',
  'DAEGU',
  'ULSAN',
  'BUSAN',
  'JEJU',
] as const;

const SERVICE_TYPES = ['SMALL_MOVE', 'HOME_MOVE', 'OFFICE_MOVE'] as const;

const regionSchema = z.enum(REGIONS, {
  error: '유효하지 않은 지역입니다.',
});

const parseServiceTypes = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serviceTypesSchema = z.preprocess(
  parseServiceTypes,
  z
    .array(
      z.enum(SERVICE_TYPES, { error: '유효하지 않은 이용 서비스입니다.' }),
      {
        error: '이용 서비스를 1개 이상 선택해주세요.',
      }
    )
    .min(1, '이용 서비스를 1개 이상 선택해주세요.')
    .transform((types) => [...new Set(types)])
);

export const upsertProfileSchema = z.object(
  {
    region: regionSchema,
    serviceTypes: serviceTypesSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
