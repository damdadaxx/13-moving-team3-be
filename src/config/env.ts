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

export const ENV = {
  NODE_ENV: env,
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
};
