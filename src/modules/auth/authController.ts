import { randomBytes } from 'crypto';
import { CookieOptions, NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { ENV } from '../../config/env';
import { Role } from '../../generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../../utils/error';
import { isSameSecret } from '../../utils/hash';
import { isSocialConfigured, SocialProfile } from './authPassport';
import authService from './authService';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  OAUTH_STATE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './authConstants';
import {
  LoginInput,
  OAuthState,
  oauthStateSchema,
  providerParamSchema,
  SignupInput,
  SocialStartQuery,
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

/*=================================================
소셜 로그인 리다이렉트 / state 쿠키
=================================================*/
/*
@ 가이드
- 소셜 로그인은 브라우저 이동 흐름이라 결과를 JSON 대신 프론트 /auth/callback 으로 302 한다
- 실패 사유는 메시지가 아니라 코드로 넘긴다 (쿼리 문자열 메시지를 그대로 화면에 띄우면 콘텐츠 스푸핑 가능)
- state 는 세션 대신 httpOnly 쿠키에 저장하고 콜백에서 직접 비교한다
  (passport.authenticate 에 문자열 state 를 넘기면 passport-oauth2 는 검증을 건너뛴다)
*/
type SocialErrorCode =
  | 'CANCELLED'
  | 'STATE_MISMATCH'
  | 'EMAIL_REQUIRED'
  | 'EMAIL_CONFLICT'
  | 'NOT_CONFIGURED'
  | 'TOO_MANY_REQUESTS'
  | 'SOCIAL_LOGIN_FAILED';

const SOCIAL_CALLBACK_PAGE_PATH = '/auth/callback';

const redirectToSocialCallbackPage = (
  res: Response,
  params: Record<string, string | undefined>
) => {
  const url = new URL(SOCIAL_CALLBACK_PAGE_PATH, ENV.FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  res.redirect(url.toString());
};

export const redirectSocialError = (
  res: Response,
  error: SocialErrorCode,
  role?: Role
) => redirectToSocialCallbackPage(res, { error, role });

const oauthStateCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  path: OAUTH_STATE_COOKIE_PATH,
});

const readOAuthStateCookie = (req: Request): OAuthState | null => {
  const raw: unknown = req.cookies?.[OAUTH_STATE_COOKIE];
  if (typeof raw !== 'string') return null;
  try {
    const result = oauthStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const logSocialError = (error: unknown) => {
  if (ENV.NODE_ENV !== 'production') {
    console.error('[social] login failed', error);
  }
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

  // GET /auth/social/:provider — state 쿠키를 심고 프로바이더 인가 페이지로 302
  startSocialLogin: (req: Request, res: Response, next: NextFunction) => {
    const { provider } = providerParamSchema.parse(req.params);
    const { role, callbackUrl } = getValidated<SocialStartQuery>(req);

    if (!isSocialConfigured(provider)) {
      return redirectSocialError(res, 'NOT_CONFIGURED', role);
    }

    const state = randomBytes(16).toString('hex');
    const saved: OAuthState = { state, provider, role, callbackUrl };
    res.cookie(OAUTH_STATE_COOKIE, JSON.stringify(saved), {
      ...oauthStateCookieOptions(),
      maxAge: OAUTH_STATE_MAX_AGE_MS,
    });

    passport.authenticate(provider, { session: false, state })(req, res, next);
  },

  // GET /auth/social/:provider/callback — state 검증 → Passport 가 code 교환·프로필 조회 → 로그인
  socialLoginCallback: (req: Request, res: Response, next: NextFunction) => {
    const { provider } = providerParamSchema.parse(req.params);
    const saved = readOAuthStateCookie(req);
    // state 는 1회용 — 결과와 상관없이 즉시 지운다
    res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions());

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (
      !saved ||
      saved.provider !== provider ||
      !state ||
      !isSameSecret(state, saved.state)
    ) {
      return redirectSocialError(res, 'STATE_MISMATCH', saved?.role);
    }

    const { role, callbackUrl } = saved;

    passport.authenticate(
      provider,
      { session: false, state },
      (error: unknown, profile: SocialProfile | false) => {
        if (error) {
          logSocialError(error);
          return redirectSocialError(res, 'SOCIAL_LOGIN_FAILED', role);
        }
        // 사용자가 동의 화면에서 취소 (error=access_denied)
        if (!profile) {
          return redirectSocialError(res, 'CANCELLED', role);
        }

        authService
          .socialLogin(profile, role)
          .then(({ accessToken, refreshToken }) => {
            setAuthCookies(res, accessToken, refreshToken);
            redirectToSocialCallbackPage(res, { callbackUrl });
          })
          .catch((loginError: unknown) => {
            if (loginError instanceof ConflictError) {
              return redirectSocialError(res, 'EMAIL_CONFLICT', role);
            }
            if (loginError instanceof BadRequestError) {
              return redirectSocialError(res, 'EMAIL_REQUIRED', role);
            }
            logSocialError(loginError);
            redirectSocialError(res, 'SOCIAL_LOGIN_FAILED', role);
          });
      }
    )(req, res, next);
  },
};

export default authController;
