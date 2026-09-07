import { z } from 'zod';

const roleSchema = z.enum(['CUSTOMER', 'MOVER'], {
  error: 'role은 CUSTOMER 또는 MOVER여야 합니다.',
});

const emailSchema = z
  .string('email은 필수 값입니다.')
  .trim()
  .toLowerCase()
  .max(100, '이메일은 100자 이하여야 합니다.')
  .pipe(z.email('올바른 이메일 형식이 아닙니다.'));

const passwordSchema = z
  .string('password는 필수 값입니다.')
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(64, '비밀번호는 64자 이하여야 합니다.');

const nameSchema = z
  .string('name은 필수 값입니다.')
  .trim()
  .min(2, '이름은 2자 이상이어야 합니다.')
  .max(20, '이름은 20자 이하여야 합니다.');

const phoneNumberSchema = z
  .string('phoneNumber는 필수 값입니다.')
  .trim()
  .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '올바른 전화번호 형식이 아닙니다.');

export const signupSchema = z.object(
  {
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
    phoneNumber: phoneNumberSchema,
    role: roleSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export const loginSchema = z.object(
  {
    email: emailSchema,
    password: z
      .string('password는 필수 값입니다.')
      .min(1, '비밀번호를 입력해주세요.'),
    role: roleSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export const updateMeSchema = z
  .object({
    name: nameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.phoneNumber !== undefined, {
    message: '수정할 이름 또는 전화번호를 입력해주세요.',
  });

export const updatePasswordSchema = z.object(
  {
    currentPassword: z
      .string('currentPassword는 필수 값입니다.')
      .min(1, '현재 비밀번호를 입력해주세요.'),
    newPassword: passwordSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export const providerParamSchema = z.object({
  provider: z.enum(['google', 'kakao', 'naver'], {
    error: 'provider는 google, kakao, naver 중 하나여야 합니다.',
  }),
});

// 프론트 릴레이 방식: 프론트가 프로바이더에서 받은 code 를 백엔드로 전달
export const socialAuthSchema = z.object(
  {
    code: z.string('code는 필수 값입니다.').min(1, 'code는 필수 값입니다.'),
    redirectUri: z.url('redirectUri 형식이 올바르지 않습니다.'),
    state: z.string().optional(),
    role: roleSchema,
  },
  { error: '요청 본문이 올바르지 않습니다.' }
);

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type ProviderParam = z.infer<typeof providerParamSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
