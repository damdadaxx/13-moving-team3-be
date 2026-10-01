import { z } from 'zod';
import { SOCIAL_PROVIDERS } from './authPassport';

const roleSchema = z.enum(['CUSTOMER', 'MOVER'], {
  error: 'role은 CUSTOMER 또는 MOVER여야 합니다.',
});

const emailSchema = z
  .string('email은 필수 값입니다.')
  .trim()
  .toLowerCase()
  .max(100, '이메일은 100자 이하여야 합니다.')
  .pipe(z.email('올바른 이메일 형식이 아닙니다.'));

/*
@ 비밀번호 규칙 (회원가입·비밀번호 변경 공통, 프론트 authValidation.ts와 동일하게 유지)
- 8~64자, 숫자 1개 이상, 특수문자 1개 이상
- 특수문자: 키보드 ASCII 특수문자 !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~ (공백·한글은 제외)
- 로그인은 기존 가입자도 들어올 수 있어야 하므로 이 규칙을 적용하지 않는다
*/
const passwordSchema = z
  .string('password는 필수 값입니다.')
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(64, '비밀번호는 64자 이하여야 합니다.')
  .regex(/[0-9]/, '비밀번호에 숫자를 포함해주세요.')
  .regex(/[!-/:-@[-`{-~]/, '비밀번호에 특수문자를 포함해주세요.');

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
    // 이메일 인증 확인 응답으로 받은 verified 토큰
    emailVerificationToken: z
      .string('emailVerificationToken은 필수 값입니다.')
      .min(1, '이메일 인증을 먼저 완료해 주세요.'),
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

/*
@ 이메일 인증번호 발송
- 같은 이메일이라도 role 이 다르면 가입할 수 있으므로 role 과 함께 받는다.
*/
export const sendEmailCodeSchema = z.object(
  {
    email: emailSchema,
    role: roleSchema,
  },
  { error: '이메일과 role 이 필요합니다.' }
);

/*
@ 이메일 인증번호 확인
- 인증번호는 6자리 숫자다.
- token 은 발송 응답으로 받은 challenge 토큰이다. 서버는 이 토큰으로만 인증번호를 검증한다.
*/
export const confirmEmailSchema = z.object(
  {
    email: emailSchema,
    role: roleSchema,
    code: z
      .string('code는 필수 값입니다.')
      .trim()
      .regex(/^\d{6}$/, '인증번호 6자리를 입력해주세요.'),
    token: z.string('token은 필수 값입니다.').min(1, 'token은 필수 값입니다.'),
  },
  { error: '이메일과 인증번호가 필요합니다.' }
);

export const providerParamSchema = z.object({
  provider: z.enum(SOCIAL_PROVIDERS, {
    error: 'provider는 google, kakao, naver 중 하나여야 합니다.',
  }),
});

// 로그인 후 돌아갈 프론트 경로. open redirect 방지를 위해 상대 경로만 허용한다.
const callbackUrlSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith('/') && !value.startsWith('//'), {
    message: 'callbackUrl은 상대 경로여야 합니다.',
  });

// GET /auth/social/:provider — 소셜 로그인 시작
export const socialStartQuerySchema = z.object({
  role: roleSchema,
  callbackUrl: callbackUrlSchema.optional(),
});

// oauthState 쿠키 (컨트롤러가 JSON 으로 저장)
export const oauthStateSchema = z.object({
  state: z.string().min(1),
  provider: providerParamSchema.shape.provider,
  role: roleSchema,
  callbackUrl: callbackUrlSchema.optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SendEmailCodeInput = z.infer<typeof sendEmailCodeSchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type ProviderParam = z.infer<typeof providerParamSchema>;
export type SocialStartQuery = z.infer<typeof socialStartQuerySchema>;
export type OAuthState = z.infer<typeof oauthStateSchema>;
