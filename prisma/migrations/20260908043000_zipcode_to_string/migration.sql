-- 우편번호를 Int -> VarChar(5) 로 변경합니다.
--
-- 한국 우편번호는 5자리 고정이므로, 기존 정수값을 5자리로 왼쪽 0 패딩하면
-- 원본이 복원됩니다. (예: 4524 -> '04524', 3722 -> '03722')
-- USING 절이 없으면 Postgres가 캐스팅을 거부하거나 값이 그대로 남습니다.

ALTER TABLE "estimateRequest"
  ALTER COLUMN "departureZipCode" TYPE VARCHAR(5)
    USING LPAD("departureZipCode"::text, 5, '0'),
  ALTER COLUMN "arrivalZipCode" TYPE VARCHAR(5)
    USING LPAD("arrivalZipCode"::text, 5, '0');
