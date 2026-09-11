/* eslint-disable no-console -- CLI 실행 결과는 표준 출력으로 알린다. */
import { prisma } from '../lib/prisma';
import { runClosePastEstimateRequests } from '../scheduler/closePastEstimateRequestsJob';

/*=================================================
이사일 경과 견적 요청 정리 — 1회 실행 CLI
=================================================*/

/*
@ 용도

- 배치를 즉시 한 번 돌린다. 스케줄러와 완전히 같은 함수를 호출한다.
- 쓰는 상황
  1) 개발 중 동작 확인 (스케줄러 주기를 기다리지 않고)
  2) 배포 직후 밀려 있던 과거 데이터 일괄 정리
  3) 플랫폼 Cron(Render/Railway 등)으로 전환했을 때의 실행 진입점

@ 실행

  npm run job:close-requests            # .env.development
  npm run job:close-requests:prod       # .env.production

@ 종료 코드

- 0: 성공. 처리 건수가 0이어도 성공이다.
- 1: 실패. 플랫폼 Cron이 실패를 감지할 수 있어야 하므로 반드시 0이 아니어야 한다.
*/

const main = async () => {
  console.log('[job] closePastEstimateRequests 시작');
  const result = await runClosePastEstimateRequests();
  return result;
};

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('[job] closePastEstimateRequests 실패', error);
    /*
    @ disconnect 실패를 삼키는 이유

    - 이미 실패로 끝나는 경로다. 정리 중 2차 에러 때문에
      원래 에러 로그가 묻히면 안 된다.
    */
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
