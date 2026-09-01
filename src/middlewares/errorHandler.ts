import { z } from 'zod';
import { AppError } from '../utils/error';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ENV } from '../config/env';

export default function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      path: req.path,
      method: req.method,
      errors: error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      date: new Date(),
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return res.status(404).json({
      path: req.path,
      method: req.method,
      message: '데이터를 찾을 수 없습니다.',
      date: new Date(),
    });
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(error);
    }
    return res.status(error.status).json({
      path: req.path,
      method: req.method,
      message: error.message,
      date: new Date(),
    });
  }

  console.error(error);
  return res.status(500).json({
    path: req.path,
    method: req.method,
    message:
      ENV.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error instanceof Error
          ? error.message
          : 'Internal Server Error',
    date: new Date(),
  });
}
