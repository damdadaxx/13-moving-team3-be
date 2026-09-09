import { CookieOptions, Request, Response } from 'express';
import { ENV } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../utils/error';
import authService from './authService';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';
import {
  LoginInput,
  providerParamSchema,
  SignupInput,
  SocialAuthInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

const success = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

// 쿠키 (인증서 전달 = 응답 관심사라 컨트롤러에 둔다)
// - secure: 개발은 http 라 false, 배포(https)만 true. true 고정 시 로컬에서 쿠키가 안 실림
// - sameSite: 'lax' — 프론트 BFF(같은 오리진) 전제. 직접 크로스 오리진 배포라면 'none' 필요
const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: 'lax',
  ...(ENV.COOKIE_DOMAIN ? { domain: ENV.COOKIE_DOMAIN } : {}),
});

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

const clearAuthCookies = (res: Response) => {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
};

const getUserId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

const authController = {
  signUp: async (req: Request, res: Response) => {
    const input = getValidated<SignupInput>(req);
    const { user, accessToken, refreshToken } = await authService.signUp(input);
    setAuthCookies(res, accessToken, refreshToken);
    success(res, user, 201);
  },

  login: async (req: Request, res: Response) => {
    const input = getValidated<LoginInput>(req);
    const { user, accessToken, refreshToken } = await authService.login(input);
    setAuthCookies(res, accessToken, refreshToken);
    success(res, user);
  },

  logout: async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    success(res, { message: '로그아웃되었습니다.' });
  },

  refresh: async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.refresh(
      req.cookies?.[REFRESH_TOKEN_COOKIE]
    );
    setAuthCookies(res, accessToken, refreshToken);
    success(res, user);
  },

  getMe: async (req: Request, res: Response) => {
    const user = await authService.getMe(getUserId(req));
    success(res, user);
  },

  updateMe: async (req: Request, res: Response) => {
    const input = getValidated<UpdateMeInput>(req);
    const user = await authService.updateMe(getUserId(req), input);
    success(res, user);
  },

  updatePassword: async (req: Request, res: Response) => {
    const input = getValidated<UpdatePasswordInput>(req);
    await authService.changePassword(getUserId(req), input);
    success(res, { message: '비밀번호가 변경되었습니다.' });
  },

  socialLogin: async (req: Request, res: Response) => {
    const input = getValidated<SocialAuthInput>(req);
    const { provider } = providerParamSchema.parse(req.params);

    if (
      new URL(input.redirectUri).origin !== new URL(ENV.FRONTEND_URL).origin
    ) {
      throw new BadRequestError('허용되지 않은 redirectUri입니다.');
    }

    const { user, accessToken, refreshToken } = await authService.socialLogin({
      ...input,
      provider,
    });
    setAuthCookies(res, accessToken, refreshToken);
    success(res, user);
  },
};

export default authController;
