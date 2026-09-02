import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { ENV } from '../../config/env';
import { AppError, BadRequestError } from '../../utils/error';
import { setAuthCookies, clearAuthCookies } from './authCookies';
import { signOAuthState, verifyOAuthState } from './authJwt';
import { isOAuthConfigured } from './passport';
import { authService } from './authService';
import { REFRESH_TOKEN_COOKIE } from './authConstants';
import { SocialProfile } from './authTypes';
import {
  LoginInput,
  ProviderParam,
  SignupInput,
  SocialQuery,
  UpdateMeInput,
  UpdatePasswordInput,
} from './authValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

const oauthRedirect = (res: Response, error?: string) => {
  const url = new URL('/auth/callback', ENV.FRONTEND_URL);
  if (error) {
    url.searchParams.set('error', error);
  } else {
    url.searchParams.set('success', 'true');
  }
  return res.redirect(url.toString());
};

const socialProfileFromUser = (user: Express.User): SocialProfile => {
  const profile = user as unknown as SocialProfile;
  if (!profile.provider || !profile.providerId || !profile.name) {
    throw new BadRequestError('소셜 프로필을 확인할 수 없습니다.');
  }
  return profile;
};

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
  await authService.logout(req.user!.id);
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

export const startOAuth = (req: Request, res: Response, next: NextFunction) => {
  const { provider, role } = getValidated<ProviderParam & SocialQuery>(req);

  if (!isOAuthConfigured(provider)) {
    return next(new AppError('해당 소셜 로그인이 설정되지 않았습니다.', 503));
  }

  const state = signOAuthState(role, provider);
  const options: passport.AuthenticateOptions = {
    session: false,
    state,
  };

  if (provider === 'google') {
    options.scope = ['profile', 'email'];
  }

  if (provider === 'kakao') {
    options.scope = ['profile_nickname', 'account_email'];
  }

  passport.authenticate(provider, options)(req, res, next);
};

export const oauthCallback = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { provider } = req.params as ProviderParam;

  if (!isOAuthConfigured(provider)) {
    return oauthRedirect(res, 'not_configured');
  }

  passport.authenticate(
    provider,
    { session: false },
    async (err: unknown, user: Express.User | false) => {
      try {
        if (err || !user) {
          return oauthRedirect(res, 'social_failed');
        }

        const state =
          typeof req.query.state === 'string' ? req.query.state : '';
        const role = verifyOAuthState(state, provider);
        const profile = socialProfileFromUser(user);
        const result = await authService.socialLogin(profile, role);
        setAuthCookies(res, result.accessToken, result.refreshToken);
        return oauthRedirect(res);
      } catch (error) {
        if (error instanceof AppError) {
          return oauthRedirect(res, error.message);
        }
        return oauthRedirect(res, 'social_failed');
      }
    }
  )(req, res, next);
};
