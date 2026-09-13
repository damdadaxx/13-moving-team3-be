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

export const ENV = {
  NODE_ENV: env,
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID,
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET,
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET,

  // 스케줄러 (src/scheduler) — 셋 다 선택값이고 기본값으로 동작한다.
  // 서버리스/다중 인스턴스 배포에서 인프로세스 배치를 끄려면 false.
  SCHEDULER_ENABLED: toBoolean(process.env.SCHEDULER_ENABLED, true),
  // 이사일 경과 견적 요청 정리 주기. 기본값은 매시 정각.
  SCHEDULER_CLOSE_REQUESTS_CRON:
    process.env.SCHEDULER_CLOSE_REQUESTS_CRON || '0 * * * *',
  // cron 표현식 해석 기준 시간대. 서버가 UTC로 떠도 KST 기준으로 돈다.
  SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE || 'Asia/Seoul',
};
