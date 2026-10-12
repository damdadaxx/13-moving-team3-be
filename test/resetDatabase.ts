import { prisma } from '../src/lib/prisma';
import { ENV } from '../src/config/env';
import { assertTestDatabase } from './assertTestDatabase';

// 마이그레이션 기록을 뺀 모든 테이블을 비운다. 각 테스트 파일의 beforeEach 에서 부른다.
export const resetDatabase = async () => {
  assertTestDatabase(ENV.DATABASE_URL);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
};
