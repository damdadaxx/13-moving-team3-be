import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import { verifyAccessToken } from './authJwt';
import { ACCESS_TOKEN_COOKIE } from './authConstants';

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
