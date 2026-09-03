import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { BadRequestError } from '../../utils/error';

type Source = 'body' | 'query' | 'params';

/**
 * auth 전용 검증 미들웨어.
 *
 * 공유 middlewares/validation.ts 와 동작은 같지만, 검증 실패 시 ZodError를
 * 그대로 흘려보내지 않고 BadRequestError(400)로 변환한다. 그래서 auth의 400
 * 응답이 앱의 다른 에러(errorHandler의 AppError 분기)와 같은 형식으로 나간다.
 */
export const validate = <T>(schema: ZodType<T>, source: Source = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const first = result.error.issues[0];
      return next(
        new BadRequestError(first?.message ?? '요청이 올바르지 않습니다.')
      );
    }

    const parsed = result.data;
    req.validatedData = {
      ...(typeof req.validatedData === 'object' && req.validatedData !== null
        ? req.validatedData
        : {}),
      ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
    };
    next();
  };
};
