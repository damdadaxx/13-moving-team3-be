import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { Role } from '../../generated/prisma/client';
import { UnauthorizedError } from '../../utils/error';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  OAUTH_STATE_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from './authConstants';

export type TokenPayload = {
  sub: string;
  role: Role;
};

const isRole = (value: unknown): value is Role =>
  value === 'CUSTOMER' || value === 'MOVER';

export const signAccessToken = (userId: string, role: Role) =>
  jwt.sign({ role }, ENV.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

export const signRefreshToken = (userId: string, role: Role) =>
  jwt.sign({ role }, ENV.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    const payload = decoded as jwt.JwtPayload & { role?: unknown };
    if (!payload.sub || !isRole(payload.role)) {
      throw new UnauthorizedError('액세스 토큰이 유효하지 않습니다.');
    }
    return { sub: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(
      '액세스 토큰이 만료되었거나 유효하지 않습니다.'
    );
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_REFRESH_SECRET);
    const payload = decoded as jwt.JwtPayload & { role?: unknown };
    if (!payload.sub || !isRole(payload.role)) {
      throw new UnauthorizedError('리프레시 토큰이 유효하지 않습니다.');
    }
    return { sub: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(
      '리프레시 토큰이 만료되었거나 유효하지 않습니다.'
    );
  }
};

export const signOAuthState = (role: Role, provider: string) =>
  jwt.sign({ role, provider }, ENV.JWT_ACCESS_SECRET, {
    expiresIn: OAUTH_STATE_EXPIRES_IN,
  });

export const verifyOAuthState = (state: string, provider: string): Role => {
  try {
    const decoded = jwt.verify(state, ENV.JWT_ACCESS_SECRET);
    const payload = decoded as jwt.JwtPayload & {
      role?: unknown;
      provider?: unknown;
    };
    if (!isRole(payload.role) || payload.provider !== provider) {
      throw new UnauthorizedError('유효하지 않은 소셜 로그인 요청입니다.');
    }
    return payload.role;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError(
      '소셜 로그인 요청이 만료되었거나 유효하지 않습니다.'
    );
  }
};
