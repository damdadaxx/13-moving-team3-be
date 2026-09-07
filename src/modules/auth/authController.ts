import { CookieOptions, NextFunction, Request, Response } from 'express';
import { UnauthorizedError as JwtUnauthorizedError } from 'express-jwt';
import { z } from 'zod';
import { ENV } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
} from '../../utils/error';
import { authService } from './authService';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';
import {
  LoginInput,
  providerParamSchema,
  SignupInput,
  SocialAuthInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

// auth 응답 형식. 실패 쪽은 파일 맨 아래 errorHandler 가 담당한다.
const success = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

// 쿠키 (인증서 전달 = 응답 관심사라 컨트롤러에 둔다)
// - secure: 개발은 http 라 false, 배포(https)만 true. true 고정 시 로컬에서 쿠키가 안 실림
// - sameSite: 'lax' — 프론트 BFF(같은 오리진) 전제. 직접 크로스 오리진 배포라면 'none' 필요
const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'lax',
  ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
});

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

const clearAuthCookies = (res: Response) => {
  const base = baseCookieOptions();
  // 심을 때와 동일한 path여야 삭제된다.
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
};

// 핸들러
export const signUp = async (req: Request, res: Response) => {
  const input = getValidated<SignupInput>(req);
  const { user, accessToken, refreshToken } = await authService.signUp(input);
  setAuthCookies(res, accessToken, refreshToken);
  success(res, user, 201);
};

export const login = async (req: Request, res: Response) => {
  const input = getValidated<LoginInput>(req);
  const { user, accessToken, refreshToken } = await authService.login(input);
  setAuthCookies(res, accessToken, refreshToken);
  success(res, user);
};

export const logout = async (req: Request, res: Response) => {
  // access 토큰 만료 여부와 무관하게 항상 성공시킨다.
  // 서버 refreshToken 정리는 refresh 쿠키로 사용자를 식별해 best-effort로 수행.
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  clearAuthCookies(res);
  success(res, { message: '로그아웃되었습니다.' });
};

export const refresh = async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.refresh(
    req.cookies?.[REFRESH_TOKEN_COOKIE]
  );
  setAuthCookies(res, accessToken, refreshToken);
  success(res, user);
};

// authenticate 를 통과하면 req.auth 가 채워진다. JwtPayload 의 sub 는 optional 이라
// 라우트에 authenticate 를 빼먹은 경우도 여기서 401 로 걸러진다.
const getUserId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

export const getMe = async (req: Request, res: Response) => {
  const user = await authService.getMe(getUserId(req));
  success(res, user);
};

export const updateMe = async (req: Request, res: Response) => {
  const input = getValidated<UpdateMeInput>(req);
  const user = await authService.updateMe(getUserId(req), input);
  success(res, user);
};

export const updatePassword = async (req: Request, res: Response) => {
  const input = getValidated<UpdatePasswordInput>(req);
  await authService.changePassword(getUserId(req), input);
  success(res, { message: '비밀번호가 변경되었습니다.' });
};

// 프론트 릴레이 소셜 로그인:
// 프론트가 프로바이더에서 받은 code 를 넘기면, 백엔드가 code→token→프로필 교환 후 일반 로그인과 동일하게 쿠키를 발급한다.
export const socialLogin = async (req: Request, res: Response) => {
  const input = getValidated<SocialAuthInput>(req);
  // 공용 validate 가 body 로 덮어쓰므로 path param 은 여기서 검증한다.
  // 실패 시 ZodError → 아래 errorHandler 가 400 VALIDATION_ERROR 로 변환.
  const { provider } = providerParamSchema.parse(req.params);

  if (new URL(input.redirectUri).origin !== new URL(ENV.FRONTEND_URL).origin) {
    throw new BadRequestError('허용되지 않은 redirectUri입니다.');
  }

  const { user, accessToken, refreshToken } = await authService.socialLogin({
    ...input,
    provider,
  });
  setAuthCookies(res, accessToken, refreshToken);
  success(res, user);
};

// ────────────────────────────────────────────────
// 에러 응답
//
// 공용 middlewares/errorHandler 는 { path, method, message, date } 로 응답한다.
// auth 는 success() 와 짝이 맞는 { success: false, message, code } 로 내보내야 해서
// authRoute 끝에 router.use(errorHandler) 로 걸어 auth 요청만 여기서 끝낸다.
// 다른 도메인은 공용 핸들러를 그대로 쓴다.
// ────────────────────────────────────────────────

/** 프론트 분기용 식별자. 메시지 문구는 바뀌어도 code 는 유지한다. */
type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

type Failure = { status: number; message: string; code: ErrorCode };

// AppError 는 공용 파일이라 code 필드가 없어서 status 로 역산한다.
const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

const PRISMA_FAILURES: Record<string, Failure> = {
  P2025: {
    status: 404,
    message: '데이터를 찾을 수 없습니다.',
    code: 'NOT_FOUND',
  },
  P2002: {
    status: 409,
    message: '이미 존재하는 데이터입니다.',
    code: 'CONFLICT',
  },
};

const toFailure = (error: unknown): Failure => {
  // 공용 validate 는 ZodError 를 그대로 next 로 넘긴다.
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message ?? '요청이 올바르지 않습니다.',
      code: 'VALIDATION_ERROR',
    };
  }

  // authenticate(express-jwt) 실패. 만료만 따로 구분해 프론트가 refresh 를 시도하게 한다.
  if (error instanceof JwtUnauthorizedError) {
    const isExpired =
      (error.inner as Error | undefined)?.name === 'TokenExpiredError';

    return isExpired
      ? {
          status: 401,
          message: '액세스 토큰이 만료되었습니다.',
          code: 'TOKEN_EXPIRED',
        }
      : {
          status: 401,
          message: '인증 권한이 없습니다. 로그인 후 이용해 주세요.',
          code: 'UNAUTHORIZED',
        };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const failure = PRISMA_FAILURES[error.code];
    if (failure) {
      return failure;
    }
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      message: error.message,
      code: CODE_BY_STATUS[error.status] ?? 'INTERNAL_ERROR',
    };
  }

  return {
    status: 500,
    message:
      ENV.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error instanceof Error
          ? error.message
          : 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  };
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const { status, message, code } = toFailure(error);

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({ success: false, message, code });
};
