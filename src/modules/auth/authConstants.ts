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

// 소셜 로그인 state 쿠키 (authController.startSocialLogin → socialLoginCallback)
// - path 는 /auth: 프론트 프록시가 Set-Cookie 의 Path=/auth 를 /api/auth 로 바꿔 넘기는 규칙에 맞춘다
// - 프로바이더 인가 화면에 머무는 시간을 고려해 10분
export const OAUTH_STATE_COOKIE = 'oauthState';
export const OAUTH_STATE_COOKIE_PATH = '/auth';
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

/*
@ 로그인 비밀번호 시도 제한 (계정당)
- express-rate-limit 을 이메일+role 키로 걸어 IP 가 바뀌어도 같은 계정이면 함께 센다 (authRateLimit.ts)
- 30분 창 안에 비밀번호를 10회 틀리면 창이 끝날 때까지 429 로 막는다
  (미들웨어가 라우트 앞에서 막으므로 잠긴 동안은 맞는 비밀번호도 통과하지 못한다)
- 로그인에 성공하면 그 계정의 카운트를 지운다
*/
export const MAX_FAILED_LOGIN_ATTEMPTS = 10;
export const LOGIN_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
