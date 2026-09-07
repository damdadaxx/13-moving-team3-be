import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ENV } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../utils/error';

/**
 * auth 라우터 전용 에러 핸들러.
 *
 * 공용 middlewares/errorHandler 는 `{ path, method, message, date }` 로 응답하는데,
 * auth 는 성공/실패를 아래 두 형태로만 통일한다.
 *   성공: { success: true, data }
 *   실패: { success: false, message, code }
 *
 * authRoute 끝에 router.use 로 걸어 auth 요청만 여기서 끝내고,
 * 다른 도메인은 기존 공용 핸들러를 그대로 쓴다.
 */

/** 프론트 분기용 식별자. 메시지 문구는 바뀌어도 code 는 유지한다. */
export type AuthErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

// AppError 는 공용 파일이라 code 필드가 없다. status 로 역산한다.
const CODE_BY_STATUS: Record<number, AuthErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

const fail = (
  res: Response,
  status: number,
  message: string,
  code: AuthErrorCode
) => res.status(status).json({ success: false, message, code });

export default function authErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // auth 의 validate 는 ZodError 를 BadRequestError 로 바꿔 던지지만, 혹시 새어나올 때를 위해.
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return fail(
      res,
      400,
      first?.message ?? '요청이 올바르지 않습니다.',
      'VALIDATION_ERROR'
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return fail(res, 404, '데이터를 찾을 수 없습니다.', 'NOT_FOUND');
    }
    if (error.code === 'P2002') {
      return fail(res, 409, '이미 존재하는 데이터입니다.', 'CONFLICT');
    }
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(error);
    }
    return fail(
      res,
      error.status,
      error.message,
      CODE_BY_STATUS[error.status] ?? 'INTERNAL_ERROR'
    );
  }

  console.error(error);
  return fail(
    res,
    500,
    ENV.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : error instanceof Error
        ? error.message
        : 'Internal Server Error',
    'INTERNAL_ERROR'
  );
}
