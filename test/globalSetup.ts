import { execSync } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { assertTestDatabase } from './assertTestDatabase';

/*
@ 가이드
- 모든 테스트 전에 한 번 실행된다.
- 셸에 DATABASE_URL 이 있으면 그것을, 없으면 .env.test 값을 쓴다 (src/config/env.ts 와 같은 우선순위).
- 안전장치를 통과한 URL 을 process.env 에 고정해 테스트 워커와 prisma CLI 가 같은 DB 를 쓰게 한다.
- prisma CLI 는 prisma7.config.ts 에서 루트 .env(운영)를 읽으므로 DATABASE_URL 을 직접 넘긴다.
*/
export default function setup() {
  const fileEnv = fs.existsSync('.env.test')
    ? dotenv.parse(fs.readFileSync('.env.test'))
    : {};
  const databaseUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;

  assertTestDatabase(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;

  execSync('npx prisma migrate deploy --config prisma7.config.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
