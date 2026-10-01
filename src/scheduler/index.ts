/* eslint-disable no-console -- 스케줄러 기동/실패는 서버 로그로 남긴다. */
import cron, { type ScheduledTask } from 'node-cron';
import { ENV } from '../config/env';
import {
  JOB_NAME,
  runClosePastEstimateRequests,
} from './closePastEstimateRequestsJob';

/*=================================================
인프로세스 스케줄러
=================================================*/

/*
@ 방식

- node-cron을 API 서버 프로세스 안에서 돌린다. Redis 등 추가 인프라가 필요 없다.
- 실제 작업은 scheduler/*Job.ts에 두고 여기서는 등록/해제만 한다.
  같은 Job 함수를 src/scripts/의 CLI가 그대로 재사용하므로,
  나중에 플랫폼 Cron(Render/Railway 등)으로 옮겨도 작업 코드는 바뀌지 않는다.

@ 제약 — 서버 인스턴스가 2대 이상이면 같은 배치가 인스턴스 수만큼 돈다

- 현재 배치는 멱등하다. 조건에 맞는 행을 같은 값으로 UPDATE 하므로
  두 번 돌아도 결과가 같고, 두 번째 실행은 대상 0건으로 끝난다.
- 다만 Notification 도메인이 붙어 MOVE_DAY 알림을 보내기 시작하면
  알림이 인스턴스 수만큼 중복 발송된다. 그 시점에 Postgres advisory lock
  (pg_try_advisory_xact_lock)으로 감싸야 한다. docs/scheduler.md 참고.
- 서버리스/스케일아웃 환경이면 SCHEDULER_ENABLED=false 로 끄고
  플랫폼 Cron이 `npm run job:close-requests`를 호출하게 한다.
*/

const tasks: ScheduledTask[] = [];

/*
@ runSafely

- cron 콜백에서 에러가 새어 나가면 unhandledRejection으로 프로세스가 죽는다.
- 배치 1회 실패가 API 서버 전체를 내리면 안 되므로
  로깅만 하고 다음 주기를 기다린다.
*/
const runSafely = async () => {
  try {
    await runClosePastEstimateRequests();
  } catch (error: unknown) {
    console.error(`[scheduler] ${JOB_NAME} 실패`, error);
  }
};

/*
@ startScheduler

- server.ts의 listen 콜백에서 한 번 호출한다.
- SCHEDULER_ENABLED=false 면 아무것도 등록하지 않는다.
*/
export const startScheduler = () => {
  if (!ENV.SCHEDULER_ENABLED) {
    console.log(
      '[scheduler] SCHEDULER_ENABLED=false — 스케줄러를 띄우지 않는다.'
    );
    return;
  }

  const expression = ENV.SCHEDULER_CLOSE_REQUESTS_CRON;

  if (!cron.validate(expression)) {
    throw new Error(
      `SCHEDULER_CLOSE_REQUESTS_CRON 값이 올바른 cron 표현식이 아닙니다: "${expression}"`
    );
  }

  const task = cron.schedule(expression, runSafely, {
    name: JOB_NAME,

    /*
    @ timezone

    - 서버는 보통 UTC로 뜨는데 이사일 판정은 KST 기준이어야 한다.
    - 표현식 해석 기준을 명시해 배포 환경에 따라 실행 시각이 흔들리지 않게 한다.
    */
    timezone: ENV.SCHEDULER_TIMEZONE,

    /*
    @ noOverlap

    - 이전 실행이 다음 주기까지 안 끝났으면 이번 주기를 건너뛴다.
    - 한 프로세스 안에서의 중복 실행만 막는다. 인스턴스 간 중복은 위 제약 참고.
    */
    noOverlap: true,
  });

  tasks.push(task);

  console.log(
    `[scheduler] ${JOB_NAME} 등록 — "${expression}" (${ENV.SCHEDULER_TIMEZONE})`
  );
};

/*
@ stopScheduler

- 등록된 모든 작업을 해제한다.
- 종료 시그널 처리나 테스트에서 타이머를 정리할 때 쓴다.
*/
export const stopScheduler = async () => {
  await Promise.all(tasks.map((task) => task.destroy()));
  tasks.length = 0;
};
