import { CookieOptions, Response } from 'express';
import { ENV } from '../../config/env';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';

// const isProd = ENV.NODE_ENV === 'production';

// path는 쿠키별로 다르게 주므로 여기서는 제외한다.
const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
});
//TODO: 프론트 쪽 BFF 도입후 lax로 바꿔야함

export const setAccessCookie = (res: Response, accessToken: string) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
};

export const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
};

export const clearAuthCookies = (res: Response) => {
  const base = baseCookieOptions();
  // 심을 때와 동일한 path여야 삭제된다.
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
};
