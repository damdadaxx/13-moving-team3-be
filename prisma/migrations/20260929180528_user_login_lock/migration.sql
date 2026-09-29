-- 계정당 비밀번호 시도 횟수 제한(로그인 잠금)을 위한 컬럼 추가
-- AlterTable
ALTER TABLE "user" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);
