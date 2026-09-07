import { z } from 'zod';
import { AppError } from '../utils/error';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ENV } from '../config/env';

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

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '데이터를 찾을 수 없습니다.',
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
        code: error.code,
        message: error.message,
      },
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        ENV.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : error instanceof Error
            ? error.message
            : 'Internal Server Error',
    },
  });
}
