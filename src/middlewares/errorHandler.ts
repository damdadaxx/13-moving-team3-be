import { z } from 'zod';
import { UnauthorizedError as JwtUnauthorizedError } from 'express-jwt';
import { ApiError } from '@google/genai';
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
  408: 'REQUEST_TIMEOUT',
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
    // 외래 키 위반 — 참조하려는 대상이 없다. (없는 moverId로 찜하기 등)
    // 잡지 않으면 500으로 새어나간다. 도메인별 메시지가 필요하면
    // 서비스에서 먼저 잡아 NotFoundError로 바꾼다. (estimateRequestService 참고)
    if (error.code === 'P2003') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '참조하는 데이터를 찾을 수 없습니다.',
        },
      });
    }
  }

  // Gemini 에러는 lib/gemini.ts 가 503 으로 바꿔 던진다. 여기는 그걸 거치지 않은 경우의 안전망이다.
  // - status 를 그대로 쓰지 않는다: Gemini 의 401·403(키 오류)을 받으면 FE 가 세션 만료로 보고 refresh 한다
  // - 원문 메시지(키·쿼터 상세)는 응답에 싣지 않고 서버 로그에만 남긴다
  if (error instanceof ApiError) {
    console.error('[gemini]', error);
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '지금은 AI 응답을 받을 수 없어요. 잠시 후 다시 시도해 주세요.',
      },
    });
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
