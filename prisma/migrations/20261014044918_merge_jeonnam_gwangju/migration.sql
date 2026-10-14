-- 전남광주통합특별시: 전라남도(JEONNAM)와 광주광역시(GWANGJU)를 JEONNAM_GWANGJU 하나로 합친다.
--
-- Prisma 가 만든 enum 교체 SQL 에 "기존 데이터 변환" 단계를 더했다.
-- (Prisma 기본 SQL 은 JEONNAM / GWANGJU 를 쓰는 행이 있으면 캐스팅에서 실패한다.
--  CLAUDE.md 의 'migrations 수동 편집 금지' 규칙의 일회성 예외로 합의하고 작성했다.)
--
-- 순서
--   1. 기사님이 전남·광주를 모두 선택한 경우 (moverId, region) 유니크가 깨지므로 한 행만 남긴다
--   2. enum 을 교체하면서 기존 값(JEONNAM, GWANGJU)을 새 값으로 바꿔 담는다
-- 전체가 한 트랜잭션이라 중간에 실패하면 모두 되돌아간다.

-- AlterEnum
BEGIN;

-- 1) 같은 기사님의 전남·광주 행이 둘이면 id 가 작은 한 행만 남긴다
DELETE FROM "moverServiceRegion" AS a
USING "moverServiceRegion" AS b
WHERE a."moverId" = b."moverId"
  AND a."region"::text IN ('JEONNAM', 'GWANGJU')
  AND b."region"::text IN ('JEONNAM', 'GWANGJU')
  AND a."id" > b."id";

-- 2) enum 교체 + 값 변환
CREATE TYPE "Region_new" AS ENUM ('SEOUL', 'GYEONGGI', 'INCHEON', 'GANGWON', 'CHUNGBUK', 'CHUNGNAM', 'SEJONG', 'DAEJEON', 'JEONBUK', 'JEONNAM_GWANGJU', 'GYEONGBUK', 'GYEONGNAM', 'DAEGU', 'ULSAN', 'BUSAN', 'JEJU');
ALTER TABLE "customerProfile" ALTER COLUMN "region" TYPE "Region_new" USING (CASE WHEN "region"::text IN ('JEONNAM', 'GWANGJU') THEN 'JEONNAM_GWANGJU' ELSE "region"::text END::"Region_new");
ALTER TABLE "moverServiceRegion" ALTER COLUMN "region" TYPE "Region_new" USING (CASE WHEN "region"::text IN ('JEONNAM', 'GWANGJU') THEN 'JEONNAM_GWANGJU' ELSE "region"::text END::"Region_new");
ALTER TYPE "Region" RENAME TO "Region_old";
ALTER TYPE "Region_new" RENAME TO "Region";
DROP TYPE "Region_old";
COMMIT;
