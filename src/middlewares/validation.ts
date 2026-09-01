import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

type Source = 'body' | 'query' | 'params';

export const validate = <T>(schema: ZodType<T>, source: Source = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(result.error); // ZodError → errorHandler로 전달
    }

    req.validatedData = result.data;
    next();
  };
};
