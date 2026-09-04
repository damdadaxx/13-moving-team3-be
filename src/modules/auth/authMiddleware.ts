import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { BadRequestError, UnauthorizedError } from '../../utils/error';
import { ACCESS_TOKEN_COOKIE } from './authConstants';
import { verifyAccessToken } from './authService';

/** 쿠키의 access 토큰을 검증해 req.user 를 채운다. */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) {
    return next(new UnauthorizedError());
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
};

type Source = 'body' | 'query' | 'params';

/**
 * zod 검증 미들웨어. 공유 middlewares/validation.ts 와 동작은 같지만, 실패 시
 * ZodError 를 그대로 흘리지 않고 BadRequestError(400)로 변환한다. 그래서 auth 의
 * 400 응답이 앱의 다른 에러(errorHandler 의 AppError 분기)와 같은 형식으로 나간다.
 * 검증 결과는 req.validatedData 에 누적 병합한다(params + body 등).
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
