import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import { AuthProvider } from '../../generated/prisma/client';
import { ENV } from '../../config/env';
import { BadRequestError } from '../../utils/error';

/*=================================================
소셜 로그인 Passport 전략 (Google / Kakao / Naver)
=================================================*/
/*
@ 가이드
- 백엔드가 인가 리다이렉트 → code 교환 → 프로필 조회를 Passport(passport-oauth2)로 처리한다
- 프로바이더별 패키지(passport-kakao, passport-naver)는 오래된 의존성이라 쓰지 않고,
  OAuth2Strategy 를 상속한 SocialStrategy 하나로 세 프로바이더를 등록한다
- 프로필은 SocialProfile 로 정규화해 passport 콜백에 넘긴다 (authController.socialLoginCallback)
@ 주의사항
- 콜백 URL 은 프론트 BFF 프록시(/api) 경유다. 각 콘솔에 아래 URL 을 등록해야 한다
  {FRONTEND_URL}/api/auth/social/{provider}/callback
- state 는 authController 가 쿠키로 직접 생성·검증한다 (세션 미사용)
*/

export const SOCIAL_PROVIDERS = ['google', 'kakao', 'naver'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export type SocialProfile = {
  provider: AuthProvider;
  providerId: string;
  email?: string;
  name: string;
  phoneNumber?: string;
};

type ProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  authorizationParams?: Record<string, string>;
};

const socialConfigs: Record<SocialProvider, ProviderConfig> = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientId: ENV.GOOGLE_CLIENT_ID,
    clientSecret: ENV.GOOGLE_CLIENT_SECRET,
    scope: 'openid email profile',
    authorizationParams: { prompt: 'select_account' },
  },
  // 카카오·네이버 동의 항목(이메일 등)은 각 콘솔에서 설정한다
  kakao: {
    authorizationUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
    clientId: ENV.KAKAO_CLIENT_ID,
    clientSecret: ENV.KAKAO_CLIENT_SECRET,
  },
  naver: {
    authorizationUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    userInfoUrl: 'https://openapi.naver.com/v1/nid/me',
    clientId: ENV.NAVER_CLIENT_ID,
    clientSecret: ENV.NAVER_CLIENT_SECRET,
  },
};

type GoogleUserInfo = { sub?: string; email?: string; name?: string };
type KakaoUserInfo = {
  id?: number | string;
  kakao_account?: {
    email?: string;
    phone_number?: string;
    profile?: { nickname?: string };
  };
};
type NaverUserInfo = {
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    mobile?: string;
  };
};

const normalizeEmail = (email: unknown) =>
  typeof email === 'string' && email.trim()
    ? email.trim().toLowerCase()
    : undefined;

// 프로바이더 고유 ID. 누락 시 String(undefined) → "undefined" 로 저장·조회되는 것을 막는다.
const toProviderId = (id: unknown) => {
  if ((typeof id !== 'string' && typeof id !== 'number') || id === '') {
    throw new BadRequestError('소셜 계정 정보를 확인할 수 없습니다.');
  }
  return String(id);
};

// 소셜 전화번호를 회원가입 폼과 같은 숫자만 형식(01012345678)으로 맞춘다.
// - 카카오 "+82 10-1234-5678", 네이버 "010-1234-5678"
// - 휴대폰 번호 형식이 아니면 저장하지 않는다(선택 값)
const normalizePhoneNumber = (phoneNumber: unknown) => {
  if (typeof phoneNumber !== 'string') return undefined;
  const digits = phoneNumber.replace(/\D/g, '');
  const local = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;
  return /^01[016789]\d{7,8}$/.test(local) ? local : undefined;
};

export const isSocialConfigured = (provider: SocialProvider) =>
  Boolean(
    socialConfigs[provider].clientId && socialConfigs[provider].clientSecret
  );

const getSocialCallbackUrl = (provider: SocialProvider) =>
  `${ENV.FRONTEND_URL}/api/auth/social/${provider}/callback`;

/** access_token → 프로필 조회 및 정규화 */
const fetchSocialProfile = async (
  provider: SocialProvider,
  accessToken: string
): Promise<SocialProfile> => {
  const res = await fetch(socialConfigs[provider].userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new BadRequestError('소셜 프로필 조회에 실패했습니다.');
  }
  const data: unknown = await res.json();

  switch (provider) {
    case 'google': {
      const d = (data ?? {}) as GoogleUserInfo;
      return {
        provider: 'GOOGLE',
        providerId: toProviderId(d.sub),
        email: normalizeEmail(d.email),
        name: d.name || '사용자',
      };
    }
    case 'kakao': {
      const d = (data ?? {}) as KakaoUserInfo;
      const account = d.kakao_account ?? {};
      return {
        provider: 'KAKAO',
        providerId: toProviderId(d.id),
        email: normalizeEmail(account.email),
        name: account.profile?.nickname || '사용자',
        phoneNumber: normalizePhoneNumber(account.phone_number),
      };
    }
    case 'naver': {
      const d = (data ?? {}) as NaverUserInfo;
      const response = d.response ?? {};
      return {
        provider: 'NAVER',
        providerId: toProviderId(response.id),
        email: normalizeEmail(response.email),
        name: response.nickname || response.name || '사용자',
        phoneNumber: normalizePhoneNumber(response.mobile),
      };
    }
  }
};

class SocialStrategy extends OAuth2Strategy {
  private readonly provider: SocialProvider;

  constructor(provider: SocialProvider) {
    super(
      {
        authorizationURL: socialConfigs[provider].authorizationUrl,
        tokenURL: socialConfigs[provider].tokenUrl,
        clientID: socialConfigs[provider].clientId ?? '',
        clientSecret: socialConfigs[provider].clientSecret ?? '',
        callbackURL: getSocialCallbackUrl(provider),
        scope: socialConfigs[provider].scope,
      },
      (
        _accessToken: string,
        _refreshToken: string,
        profile: SocialProfile,
        done: OAuth2Strategy.VerifyCallback
      ) => done(null, profile)
    );
    this.name = provider;
    this.provider = provider;
  }

  userProfile(
    accessToken: string,
    done: (err?: unknown, profile?: SocialProfile) => void
  ) {
    fetchSocialProfile(this.provider, accessToken).then(
      (profile) => done(null, profile),
      (error: unknown) => done(error)
    );
  }

  authorizationParams() {
    return socialConfigs[this.provider].authorizationParams ?? {};
  }

  // 네이버는 토큰 요청에도 state 를 요구한다. 콜백의 authenticate 옵션으로 넘긴 state 를 싣는다.
  tokenParams(options: { state?: string }) {
    return this.provider === 'naver' && options.state
      ? { state: options.state }
      : {};
  }
}

/** 키가 설정된 프로바이더만 등록한다. 미설정 프로바이더는 컨트롤러가 NOT_CONFIGURED 로 안내한다. */
export const registerSocialStrategies = () => {
  SOCIAL_PROVIDERS.filter(isSocialConfigured).forEach((provider) => {
    passport.use(new SocialStrategy(provider));
  });
};
