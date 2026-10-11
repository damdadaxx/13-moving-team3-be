import dotenv from 'dotenv';

const env = process.env.NODE_ENV || 'development';

// 환경별 파일 먼저 로드 (우선순위 높음 — dotenv는 이미 설정된 키를 덮지 않음)
dotenv.config({ path: `.env.${env}` });
// 공통값 (JWT 시크릿 등)
dotenv.config({ path: '.env' });

// 필수 환경변수 검증 — 빠졌으면 서버 뜨기 전에 즉시 실패
const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'AWS_REGION',
  'AWS_PRIVATE_BUCKET_NAME',
  'CLOUDFRONT_DOMAIN',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다. (NODE_ENV=${env})`);
  }
}

/*
 * 불리언 환경변수 파싱.
 * 값이 없으면 defaultValue를 쓰고, 'false'/'0'만 거짓으로 본다.
 */
const toBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false' && value !== '0';
};

/*
 * CloudFront 주소를 `https://도메인` 형태로 통일합니다.
 * 뒤에 슬래시가 있거나 path/query가 섞이면 이미지 URL 조합과 삭제 대상 확인이
 * 달라질 수 있으므로, 서버 시작 시 한 번 검증해서 잘못된 설정을 빨리 찾습니다.
 */
const toHttpsOrigin = (value: string, key: string) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`환경변수 ${key}는 올바른 URL이어야 합니다.`);
  }

  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `환경변수 ${key}는 path 없이 https://도메인 형식이어야 합니다.`
    );
  }

  return url.origin;
};

export const ENV = {
  NODE_ENV: env,
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  // S3에는 비공개 원본을 저장하고, 클라이언트에는 CloudFront URL만 반환합니다.
  AWS_REGION: process.env.AWS_REGION!,
  // 팀 환경변수 이름을 S3 저장 모듈에서 사용하는 내부 이름으로 연결합니다.
  S3_BUCKET_NAME: process.env.AWS_PRIVATE_BUCKET_NAME!,
  CLOUDFRONT_BASE_URL: toHttpsOrigin(
    process.env.CLOUDFRONT_DOMAIN!,
    'CLOUDFRONT_DOMAIN'
  ),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  PROXY_SECRET: process.env.PROXY_SECRET || undefined,
  // 메일(Resend). 키가 없으면 개발 환경에서 콘솔 출력으로 대체된다
  // MAIL_FROM 은 Resend 에서 인증한 도메인(moving-team3.xyz) 주소여야 한다
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM || '무빙 <no-reply@moving-team3.xyz>',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET,
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET,

  // Redis 캐시 (src/lib/redis.ts). 없으면 캐시 없이 동작한다
  REDIS_URL: process.env.REDIS_URL || undefined,

  // 스케줄러 (src/scheduler) — 셋 다 선택값이고 기본값으로 동작한다.
  // 서버리스/다중 인스턴스 배포에서 인프로세스 배치를 끄려면 false.
  SCHEDULER_ENABLED: toBoolean(process.env.SCHEDULER_ENABLED, true),
  // 이사일 경과 견적 요청 정리 주기. 기본값은 매시 정각.
  SCHEDULER_CLOSE_REQUESTS_CRON:
    process.env.SCHEDULER_CLOSE_REQUESTS_CRON || '0 * * * *',
  // cron 표현식 해석 기준 시간대. 서버가 UTC로 떠도 KST 기준으로 돈다.
  SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE || 'Asia/Seoul',
};
