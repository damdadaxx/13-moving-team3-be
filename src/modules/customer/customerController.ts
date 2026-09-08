import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError as JwtUnauthorizedError } from 'express-jwt';
import { z } from 'zod';
import { ENV } from '../../config/env';
import { Prisma } from '../../generated/prisma/client';
import { AppError, UnauthorizedError } from '../../utils/error';
import { customerService } from './customerService';
import { UpsertProfileInput } from './customerValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

const success = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

const getUserId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

export const createProfile = async (req: Request, res: Response) => {
  const input = getValidated<UpsertProfileInput>(req);
  const profile = await customerService.create(getUserId(req), input);
  success(res, profile, 201);
};

export const getProfile = async (req: Request, res: Response) => {
  const profile = await customerService.get(getUserId(req));
  success(res, profile);
};

export const updateProfile = async (req: Request, res: Response) => {
  const input = getValidated<UpsertProfileInput>(req);
  const profile = await customerService.update(getUserId(req), input);
  success(res, profile);
};

// ────────────────────────────────────────────────
// 에러 응답 — auth 와 같은 뼈대, code 만 도메인 매핑
// ────────────────────────────────────────────────

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_REGION'
  | 'INVALID_SERVICE_TYPES'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_ALREADY_EXISTS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

type Failure = { status: number; message: string; code: ErrorCode };

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'PROFILE_NOT_FOUND',
  409: 'PROFILE_ALREADY_EXISTS',
};

const zodCode = (path: string): ErrorCode => {
  if (path === 'region') return 'INVALID_REGION';
  if (path === 'serviceTypes' || path.startsWith('serviceTypes.')) {
    return 'INVALID_SERVICE_TYPES';
  }
  return 'VALIDATION_ERROR';
};

const toFailure = (error: unknown): Failure => {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return {
      status: 400,
      message: first?.message ?? '요청이 올바르지 않습니다.',
      code: zodCode(first?.path.join('.') ?? ''),
    };
  }

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
    if (error.code === 'P2025') {
      return {
        status: 404,
        message: '등록된 프로필이 없습니다.',
        code: 'PROFILE_NOT_FOUND',
      };
    }
    if (error.code === 'P2002') {
      return {
        status: 409,
        message: '이미 등록된 프로필입니다.',
        code: 'PROFILE_ALREADY_EXISTS',
      };
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
