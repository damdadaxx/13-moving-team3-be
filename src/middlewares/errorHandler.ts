import { z } from 'zod';
import { UnauthorizedError as JwtUnauthorizedError } from 'express-jwt';
import { AppError } from '../utils/error';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ENV } from '../config/env';

// AppError는 status로 body code를 역산한다.
// 같은 status를 쓰는 에러는 사유가 달라도 같은 code로 응답한다 — 세분화가 필요하면 message로 구분한다.
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

export default function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '요청 값이 올바르지 않습니다.',
        fields: error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // authenticate(express-jwt) 실패. 만료만 따로 구분해 프론트가 refresh를 시도하게 한다.
  if (error instanceof JwtUnauthorizedError) {
    const isExpired =
      (error.inner as Error | undefined)?.name === 'TokenExpiredError';

    return res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        message: isExpired
          ? '액세스 토큰이 만료되었습니다.'
          : '인증 권한이 없습니다. 로그인 후 이용해 주세요.',
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '데이터를 찾을 수 없습니다.',
        },
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '이미 존재하는 데이터입니다.',
        },
      });
    }
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(error);
    }
    return res.status(error.status).json({
      success: false,
      error: {
        code: CODE_BY_STATUS[error.status] ?? 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        ENV.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : error instanceof Error
            ? error.message
            : 'Internal Server Error',
    },
  });
}
