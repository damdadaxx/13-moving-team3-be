/**
 * 커서 기반 무한 스크롤 페이지네이션 유틸.
 * 커서로 쓰는 필드는 반드시 고유(unique)한 `id`여야 한다.
 *
 * 사용법 1) repository — Prisma 쿼리 옵션 조립
 *   return prisma.estimateRequest.findMany({
 *     where: ...,
 *     ...buildCursorArgs(cursor, size),
 *     // tie-break로 id를 같이 정렬해야 정렬 기준(createdAt 등)이 동률일 때도 안정적으로 동작한다.
 *     orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
 *   });
 *
 * 사용법 2) service — 조회 결과를 응답 모양으로 자르기
 *   const rows = await repository.findManyWithEstimates({ cursor, size });
 *   const { items, nextCursor } = paginateByCursor(rows, size);
 *   return { list: items.map(mapper), nextCursor };
 *
 * 동작 원리: buildCursorArgs가 항상 size+1건을 요청하도록 take를 만들어준다.
 * 실제로 size+1건이 돌아오면(=초과분이 있으면) 다음 페이지가 있다는 뜻이므로,
 * paginateByCursor가 마지막 1건을 잘라내고 그 앞의 마지막 항목 id를 nextCursor로 내려준다.
 * 응답이 size건 이하면 더 볼 게 없다는 뜻이라 nextCursor는 null이다.
 */

export const buildCursorArgs = (cursor: string | undefined, size: number) => ({
  take: size + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
});

export const paginateByCursor = <T extends { id: string }>(
  rows: T[],
  size: number
): { items: T[]; nextCursor: string | null } => {
  const hasNext = rows.length > size;
  const items = hasNext ? rows.slice(0, size) : rows;
  const nextCursor = hasNext ? items[items.length - 1].id : null;

  return { items, nextCursor };
};
