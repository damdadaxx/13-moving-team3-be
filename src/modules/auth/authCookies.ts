import { CookieOptions, Response } from 'express';
import { ENV } from '../../config/env';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';

const isProd = ENV.NODE_ENV === 'production';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
});

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  const base = baseCookieOptions();
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...base,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...base,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

export const clearAuthCookies = (res: Response) => {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, base);
};
