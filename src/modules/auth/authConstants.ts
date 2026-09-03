export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

// refresh 쿠키는 /auth/* 에만 전송되도록 path를 좁힌다.
// - 7일짜리 장수명 크리덴셜을 트래픽 대부분(견적/기사 등)에 싣지 않기 위함
// - /auth/logout 도 이 쿠키로 사용자를 식별해 서버 refreshToken을 정리한다
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';

export const ACCESS_TOKEN_EXPIRES_IN = '15m';
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const OAUTH_STATE_EXPIRES_IN = '10m';
