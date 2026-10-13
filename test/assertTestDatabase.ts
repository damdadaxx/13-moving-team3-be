/*=================================================
테스트 DB 안전장치
=================================================*/
/*
@ 가이드
- 테스트는 매번 테이블을 비운다(resetDatabase). 운영 DB 를 가리키면 데이터가 전부 사라진다.
- 로컬(localhost) 이면서 DB 이름이 _test 로 끝날 때만 통과시킨다.
@ 주의사항
- 루트 .env 에는 운영 RDS 주소가 있다. .env.test 가 없거나 DATABASE_URL 이 빠지면
  그쪽으로 붙을 수 있어 반드시 여기서 막는다.
*/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const assertTestDatabase = (databaseUrl: string | undefined) => {
  if (!databaseUrl) {
    throw new Error(
      '[test] DATABASE_URL 이 없습니다. .env.test 를 확인하세요.'
    );
  }

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');

  if (!LOCAL_HOSTS.has(url.hostname) || !dbName.endsWith('_test')) {
    throw new Error(
      `[test] 테스트 DB 가 아닙니다 (host=${url.hostname}, db=${dbName}). ` +
        'localhost 의 *_test DB 에서만 테스트를 실행합니다.'
    );
  }
};
