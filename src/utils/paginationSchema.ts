import { z } from 'zod';

/**
 * 목록 조회 페이지 크기·페이지 번호 공용 Zod 스키마.
 *
 * 상한이 없으면 클라이언트가 size=1000000 같은 값으로 전체 테이블을 긁어갈 수 있고,
 * 정수 검증이 없으면 size=10.5 가 Prisma take 에 그대로 들어가 500 이 된다.
 * 목록 API 는 커서 방식(size)이든 오프셋 방식(page/pageSize)이든 이 스키마를 쓴다.
 *
 * 사용법:
 *   export const getLikeMoverListSchema = z.object({
 *     cursor: z.uuid().optional(),
 *     size: pageSizeSchema(),
 *   });
 *
 * 기사님 목록(moverValidation)은 카드 그리드 특성상 100건까지 허용하는
 * 자체 상한을 이미 갖고 있어 이 스키마를 쓰지 않는다.
 */

/** 한 번에 조회할 수 있는 최대 건수 */
export const MAX_PAGE_SIZE = 50;

/** 클라이언트가 크기를 지정하지 않았을 때의 기본 건수 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * 페이지 크기(size / pageSize) 스키마.
 * @param defaultSize 값이 없을 때 사용할 기본 건수
 */
export const pageSizeSchema = (defaultSize: number = DEFAULT_PAGE_SIZE) =>
  z.coerce
    .number('페이지 크기는 숫자여야 합니다.')
    .int('페이지 크기는 정수여야 합니다.')
    .min(1, '페이지 크기는 1 이상이어야 합니다.')
    .max(MAX_PAGE_SIZE, `페이지 크기는 최대 ${MAX_PAGE_SIZE}까지 가능합니다.`)
    .default(defaultSize);

/** 오프셋 페이지네이션의 페이지 번호(1부터 시작) 스키마. */
export const pageNumberSchema = () =>
  z.coerce
    .number('페이지 번호는 숫자여야 합니다.')
    .int('페이지 번호는 정수여야 합니다.')
    .min(1, '페이지 번호는 1 이상이어야 합니다.')
    .default(1);
