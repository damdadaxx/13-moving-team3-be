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

const serviceTypesSchema = z
  .array(z.enum(SERVICE_TYPES, { error: '유효하지 않은 이용 서비스입니다.' }), {
    error: '이용 서비스를 1개 이상 선택해주세요.',
  })
  .min(1, '이용 서비스를 1개 이상 선택해주세요.')
  .transform((types) => [...new Set(types)]);

const imgUrlSchema = z
  .union([z.url('imgUrl 형식이 올바르지 않습니다.'), z.null()])
  .optional();

export const upsertProfileSchema = z.object(
  {
    imgUrl: imgUrlSchema,
    region: regionSchema,
    serviceTypes: serviceTypesSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
