import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import errorHandler from '../../src/middlewares/errorHandler';
import { requireCustomer } from '../../src/middlewares/authenticate';
import { Prisma } from '../../src/generated/prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/error';

const handle = (error: unknown) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  errorHandler(error, {} as Request, res as unknown as Response, jest.fn());
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
};

describe('errorHandler 미들웨어', () => {
  test('ZodError 는 400 VALIDATION_ERROR 와 필드별 메시지', () => {
    const parsed = z.object({ price: z.number() }).safeParse({ price: 'x' });

    const { status, body } = handle(parsed.error);

    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields[0].field).toBe('price');
  });

  test.each([
    [new NotFoundError('없음'), 404, 'NOT_FOUND'],
    [new ConflictError('중복'), 409, 'CONFLICT'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
  ])('AppError 는 status 로 code 를 정한다 (%s)', (error, status, code) => {
    const result = handle(error);

    expect(result.status).toBe(status);
    expect(result.body).toEqual({
      success: false,
      error: { code, message: error.message },
    });
  });

  test.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('Prisma %s 는 %d', (prismaCode, status, code) => {
    const error = new Prisma.PrismaClientKnownRequestError('db', {
      code: prismaCode,
      clientVersion: 'test',
    });

    const result = handle(error);

    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
  });

  test('알 수 없는 에러는 500 이고 테스트 환경에서도 success: false 래퍼를 지킨다', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { status, body } = handle(new Error('boom'));

    expect(status).toBe(500);
    expect(body.success).toBe(false);
  });
});

describe('requireCustomer 미들웨어', () => {
  const run = (role?: string) => {
    const next = jest.fn() as NextFunction;
    requireCustomer(
      { auth: role ? { role } : undefined } as unknown as Request,
      {} as Response,
      next
    );
    return next as jest.Mock;
  };

  test('고객이면 통과', () => {
    expect(run('CUSTOMER')).toHaveBeenCalledWith();
  });

  test('기사님이거나 인증 정보가 없으면 ForbiddenError', () => {
    expect(run('MOVER')).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(run()).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
