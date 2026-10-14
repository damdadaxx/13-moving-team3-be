import type { Request } from 'express';
import { UnauthorizedError } from './error';

export const getUserId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};
