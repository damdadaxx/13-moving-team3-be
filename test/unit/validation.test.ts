import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { validate } from '../../src/middlewares/validation';

const schema = z.object({ price: z.coerce.number().min(1) });

const run = (source: 'body' | 'query', value: unknown) => {
  const req = { [source]: value } as unknown as Request;
  const next = jest.fn() as NextFunction;
  validate(schema, source)(req, {} as Response, next);
  return { req, next: next as jest.Mock };
};

describe('validate 미들웨어', () => {
  test('통과하면 파싱된 값을 req.validatedData 에 담고 next() 를 인자 없이 호출한다', () => {
    const { req, next } = run('body', { price: '1000' });

    expect(req.validatedData).toEqual({ price: 1000 });
    expect(next).toHaveBeenCalledWith();
  });

  test('query 도 같은 방식으로 검증한다', () => {
    const { req } = run('query', { price: '5' });

    expect(req.validatedData).toEqual({ price: 5 });
  });

  test('실패하면 ZodError 를 next 로 넘기고 validatedData 를 채우지 않는다', () => {
    const { req, next } = run('body', { price: 0 });

    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
    expect(req.validatedData).toBeUndefined();
  });
});
