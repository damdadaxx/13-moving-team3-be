import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from 'passport-google-oauth20';
import {
  Strategy as KakaoStrategy,
  Profile as KakaoProfile,
} from 'passport-kakao';
import {
  Strategy as NaverStrategy,
  Profile as NaverProfile,
} from 'passport-naver';
import { ENV } from '../../config/env';
import { SocialProfile, SocialProvider } from './authTypes';

const callbackURL = (provider: SocialProvider) =>
  `${ENV.API_BASE_URL.replace(/\/$/, '')}/auth/${provider}/callback`;

const toSocialUser = (profile: SocialProfile) =>
  profile as unknown as Express.User;

const normalizeGoogle = (profile: GoogleProfile): SocialProfile => ({
  provider: 'GOOGLE',
  providerId: profile.id,
  email: profile.emails?.[0]?.value?.trim().toLowerCase(),
  name: profile.displayName || profile.name?.givenName || '사용자',
});

const normalizeKakao = (profile: KakaoProfile): SocialProfile => ({
  provider: 'KAKAO',
  providerId: String(profile.id),
  email: profile._json.kakao_account?.email?.trim().toLowerCase(),
  name:
    profile.displayName ||
    profile.username ||
    profile._json.properties?.nickname ||
    '사용자',
  phoneNumber: profile._json.kakao_account?.phone_number,
});

const normalizeNaver = (profile: NaverProfile): SocialProfile => ({
  provider: 'NAVER',
  providerId: profile.id,
  email: (profile.emails?.[0]?.value || profile._json.email)
    ?.trim()
    .toLowerCase(),
  name: profile.displayName || profile._json.nickname || '사용자',
  phoneNumber: profile._json.mobile,
});

export const isOAuthConfigured = (provider: SocialProvider) => {
  switch (provider) {
    case 'google':
      return Boolean(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET);
    case 'kakao':
      return Boolean(ENV.KAKAO_CLIENT_ID && ENV.KAKAO_CLIENT_SECRET);
    case 'naver':
      return Boolean(ENV.NAVER_CLIENT_ID && ENV.NAVER_CLIENT_SECRET);
  }
};

export const registerPassportStrategies = () => {
  if (ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET) {
    passport.use(
      'google',
      new GoogleStrategy(
        {
          clientID: ENV.GOOGLE_CLIENT_ID,
          clientSecret: ENV.GOOGLE_CLIENT_SECRET,
          callbackURL: callbackURL('google'),
        },
        (_accessToken, _refreshToken, profile, done) => {
          done(null, toSocialUser(normalizeGoogle(profile)));
        }
      )
    );
  }

  if (ENV.KAKAO_CLIENT_ID && ENV.KAKAO_CLIENT_SECRET) {
    passport.use(
      'kakao',
      new KakaoStrategy(
        {
          clientID: ENV.KAKAO_CLIENT_ID,
          clientSecret: ENV.KAKAO_CLIENT_SECRET,
          callbackURL: callbackURL('kakao'),
        },
        (_accessToken, _refreshToken, profile, done) => {
          done(null, toSocialUser(normalizeKakao(profile)));
        }
      )
    );
  }

  if (ENV.NAVER_CLIENT_ID && ENV.NAVER_CLIENT_SECRET) {
    passport.use(
      'naver',
      new NaverStrategy(
        {
          clientID: ENV.NAVER_CLIENT_ID,
          clientSecret: ENV.NAVER_CLIENT_SECRET,
          callbackURL: callbackURL('naver'),
        },
        (_accessToken, _refreshToken, profile, done) => {
          done(null, toSocialUser(normalizeNaver(profile)));
        }
      )
    );
  }
};
