import { CookieOptions, Request, Response } from 'express';
import { ENV } from '../../config/env';
import { BadRequestError } from '../../utils/error';
import { authService } from './authService';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';
import {
  LoginInput,
  ProviderParam,
  SignupInput,
  SocialAuthInput,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

// 쿠키 (인증서 전달 = 응답 관심사라 컨트롤러에 둔다)
// TODO: 프론트 BFF 도입 후 sameSite 를 'lax' 로 유지, secure 는 배포에서만
const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: true,
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
  // 심을 때와 동일한 path여야 삭제된다.
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
};

// 핸들러
export const signUp = async (req: Request, res: Response) => {
  const input = getValidated<SignupInput>(req);
  const { user, accessToken, refreshToken } = await authService.signUp(input);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json(user);
};

export const login = async (req: Request, res: Response) => {
  const input = getValidated<LoginInput>(req);
  const { user, accessToken, refreshToken } = await authService.login(input);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json(user);
};

export const logout = async (req: Request, res: Response) => {
  // access 토큰 만료 여부와 무관하게 항상 성공시킨다.
  // 서버 refreshToken 정리는 refresh 쿠키로 사용자를 식별해 best-effort로 수행.
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  clearAuthCookies(res);
  res.status(200).json({ message: '로그아웃되었습니다.' });
};

export const refresh = async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.refresh(
    req.cookies?.[REFRESH_TOKEN_COOKIE]
  );
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json(user);
};

export const getMe = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json(user);
};

export const updateMe = async (req: Request, res: Response) => {
  const input = getValidated<UpdateMeInput>(req);
  const user = await authService.updateMe(req.user!.id, input);
  res.status(200).json(user);
};

export const updatePassword = async (req: Request, res: Response) => {
  const input = getValidated<UpdatePasswordInput>(req);
  await authService.changePassword(req.user!.id, input);
  res.status(200).json({ message: '비밀번호가 변경되었습니다.' });
};

// 프론트 릴레이 소셜 로그인:
// 프론트가 프로바이더에서 받은 code 를 넘기면, 백엔드가 code→token→프로필 교환 후 일반 로그인과 동일하게 쿠키를 발급한다.
export const socialLogin = async (req: Request, res: Response) => {
  const input = getValidated<ProviderParam & SocialAuthInput>(req);

  if (new URL(input.redirectUri).origin !== new URL(ENV.FRONTEND_URL).origin) {
    throw new BadRequestError('허용되지 않은 redirectUri입니다.');
  }

  const { user, accessToken, refreshToken } =
    await authService.socialLogin(input);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json(user);
};
