# [트러블슈팅] 이사일이 지난 견적 요청이 영원히 열려 있던 문제 — node-cron 도입

> 관련 PR: #39 · 라이브러리: `node-cron@4.6.0`

## 1. 문제 상황

이사일이 지난 견적 요청이 `PENDING` / `CONFIRMED` 상태에서 벗어나지 못했다.
그 결과 다음 기능이 모두 동작하지 않았다.

| 증상                                          | 근거                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 고객이 **두 번째 견적 요청을 넣을 수 없음**   | `schema.prisma`의 부분 유니크 인덱스가 `status IN ('PENDING','CONFIRMED')`를 1건으로 제한 |
| **리뷰 작성 불가**                            | `reviewService.createReview`가 `estimateRequest.status === 'COMPLETED'`를 요구            |
| `GET /reviews/me` 항상 빈 배열                | `where.estimateRequest.status = 'COMPLETED'`                                              |
| `GET /estimate-requests/history` 항상 빈 배열 | `status IN ('COMPLETED','EXPIRED')`만 조회                                                |

## 2. 원인

상태를 정리하는 로직 `estimateRequestRepository.closePastEstimateRequests()`는 이미 구현돼 있었다.
하지만 **이 함수를 호출하는 곳이 아무 데도 없었다.** 서비스가 감싸기만 했고, 스케줄러도 라우트도 연결되지 않았다.

`estimateService`에 `moveDate`를 따로 검사하는 우회 코드가 생긴 것도 같은 원인이다
(주석: "자동 전환해주는 배치가 아직 없어서").

이 함수는 `moveDate < now`인 열린 요청을 한 트랜잭션 안에서 다음과 같이 정리한다.

| 대상                                                             | 전환                         |
| ---------------------------------------------------------------- | ---------------------------- |
| `EstimateRequest.status = CONFIRMED`                             | → `COMPLETED` (이사 완료)    |
| `EstimateRequest.status = PENDING`                               | → `EXPIRED` (확정 없이 경과) |
| 만료된 요청의 `Estimate.status IN (PROPOSED, DESIGNATED)`        | → `EXPIRED`                  |
| 처리된 요청을 가리키던 `CustomerProfile.activeEstimateRequestId` | → `null`                     |

즉, 로직 문제가 아니라 **"주기적으로 실행해 줄 주체가 없다"** 는 문제였다.

## 3. 해결 방법 선택

| 후보                     | 판단                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| **`node-cron@4.6.0`** ✅ | 의존성 0개, 타입 내장(`@types/*` 불필요), `timezone`·`noOverlap` 네이티브 지원 |
| `croner@10`              | 조건은 동일하고 DST 처리가 더 견고. 한국은 서머타임이 없어 실질 차이 없음      |
| BullMQ + Redis           | 잡 1개 때문에 Redis 인프라를 추가할 이유가 없음                                |
| `pg_cron`                | 관리형 Postgres 무료 티어에서 보통 설치 불가                                   |

추가 인프라 없이 API 서버 프로세스 안에서 돌릴 수 있는 `node-cron`을 선택했다.

## 4. 적용하면서 마주친 문제와 대응

### 4-1. 배치 에러 한 번에 API 서버 전체가 죽을 수 있다

- **문제:** cron 콜백에서 에러가 새어 나가면 `unhandledRejection`으로 프로세스가 종료된다.
- **대응:** `runSafely`로 감싸서 에러를 로그로만 남기고 다음 주기를 기다린다.

```ts
const runSafely = async () => {
  try {
    await runClosePastEstimateRequests();
  } catch (error: unknown) {
    console.error(`[scheduler] ${JOB_NAME} 실패`, error);
  }
};
```

### 4-2. 서버가 UTC로 뜨면 실행 시각이 어긋난다

- **문제:** 배포 서버는 보통 UTC 기준인데, 이사일 판정은 KST 기준이어야 한다.
- **대응:** cron 표현식을 해석할 시간대를 명시했다. `timezone: 'Asia/Seoul'` (`SCHEDULER_TIMEZONE`)

### 4-3. 이전 실행이 안 끝났는데 다음 실행이 겹친다

- **문제:** 밀린 데이터가 많으면 다음 주기까지 실행이 끝나지 않을 수 있다.
- **대응:** node-cron의 `noOverlap: true` 옵션을 켰다. 직접 실행 중 플래그를 만들 필요가 없다.
- **한계:** 같은 프로세스 안에서의 중복만 막는다 (→ 4-6).

### 4-4. cron 표현식에 오타가 있으면 배치가 조용히 안 돈다

- **문제:** 환경변수로 받은 표현식이 잘못돼도 겉으로는 아무 일도 일어나지 않는다.
- **대응:** 기동 시 `cron.validate()`로 검사하고, 잘못된 값이면 **서버를 띄우지 않고 즉시 실패**시킨다.

```ts
if (!cron.validate(expression)) {
  throw new Error(`SCHEDULER_CLOSE_REQUESTS_CRON 값이 올바른 cron 표현식이 아닙니다: "${expression}"`);
}
```

### 4-5. 하루 1회로 돌리면 최대 24시간 동안 새 요청을 못 넣는다

- **문제:** `moveDate`는 날짜가 아니라 `DateTime`이다. 하루 1회 실행이면 이사일이 지난 뒤에도
  최대 24시간 동안 요청이 `PENDING`에 묶여, 고객이 새 견적 요청을 넣을 수 없다.
- **대응:** 기본 주기를 매시 정각(`0 * * * *`)으로 잡았다. 대상이 없으면 쿼리 1번으로 끝나서 비용은 거의 없다.
- 남는 최대 1시간 공백은 `estimateService`의 `moveDate` 우회 검사가 메운다.

### 4-6. 서버가 2대 이상이면 배치도 그만큼 돈다

- **현재:** 배치가 멱등하다. 같은 행을 같은 값으로 UPDATE 하므로, 두 번째 실행은 대상 0건으로 끝난다.
- **위험:** Notification 도메인이 붙어 `MOVE_DAY` 알림을 보내기 시작하면 알림이 인스턴스 수만큼 중복 발송된다.
- **대응 예정:** 그 시점에 Postgres advisory lock으로 감싼다. Redis 없이 기존 연결만으로 된다.

```ts
// estimateRequestRepository.closePastEstimateRequests()의 트랜잭션 맨 앞
const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
  SELECT pg_try_advisory_xact_lock(918273) AS locked
`;
if (!locked) {
  return { completed: 0, expired: 0, expiredEstimates: 0 };
}
```

- 서버리스/스케일아웃 환경이면 `SCHEDULER_ENABLED=false`로 끄고,
  플랫폼 Cron(Render / Railway / GitHub Actions)이 `npm run job:close-requests:prod`를 호출하게 한다.

### 4-7. 배치가 멈춘 건지, 처리할 게 없는 건지 구분이 안 된다

- **대응:** 처리 건수가 0이어도 항상 결과 로그를 남긴다.

```
[scheduler] closePastEstimateRequests 완료 — 완료 2건, 만료 1건, 만료된 견적 3건 (48ms)
```

## 5. 최종 구조

```
src/scheduler/
├─ index.ts                          cron 등록/해제 — startScheduler() / stopScheduler()
└─ closePastEstimateRequestsJob.ts   잡 본체 — 서비스 호출 + 로깅
src/scripts/
└─ closePastEstimateRequests.ts      같은 잡을 1회 실행하는 CLI (exit 0 성공 / 1 실패)
```

- 등록부와 잡을 나눠서 **스케줄러와 CLI가 같은 함수를 공유**한다. 플랫폼 Cron으로 옮겨도 잡 코드는 바뀌지 않는다.
- `server.ts`의 `listen` 콜백에서 `startScheduler()`를 호출한다. 포트가 열린 뒤라 첫 배치 중에도 요청을 처리할 수 있다.
- 비즈니스 규칙은 기존대로 `estimateRequestService`에 둔다.

환경변수 (모두 선택값, 기본값으로 동작):

| 키                              | 기본값       | 설명                                       |
| ------------------------------- | ------------ | ------------------------------------------ |
| `SCHEDULER_ENABLED`             | `true`       | `'false'`/`'0'`이면 스케줄러를 띄우지 않음 |
| `SCHEDULER_CLOSE_REQUESTS_CRON` | `0 * * * *`  | 실행 주기 (매시 정각)                      |
| `SCHEDULER_TIMEZONE`            | `Asia/Seoul` | cron 표현식 해석 기준 시간대               |

## 6. 확인 방법

```bash
npm run dev                  # 기동 로그에 "[scheduler] closePastEstimateRequests 등록" 확인
npm run job:close-requests   # 주기를 기다리지 않고 즉시 1회 실행
```

- 빠르게 테스트하려면 `.env.development`에 `SCHEDULER_CLOSE_REQUESTS_CRON=* * * * *` (1분마다)
- 같은 명령을 두 번 실행해 두 번째가 0건인지 보면 멱등성을 확인할 수 있다.
- 배치 후 `GET /estimate-requests/history`, `POST /estimate-requests`, `GET /reviews/me`가 정상 동작하는지 확인한다.

## 7. 결과와 남은 과제

**결과**

- 이사일이 지난 요청이 매시 자동으로 `COMPLETED` / `EXPIRED`로 정리된다.
- 고객 재요청, 리뷰 작성, 이사 이력 조회가 다시 동작한다.

**남은 과제**

- 배치 본체를 실제 개발 DB에 대고 돌려 보는 검증이 PR 당시에는 DB 인증 오류로 하지 못했다.
- `stopScheduler()`는 구현돼 있지만 호출하는 곳이 없다. `SIGTERM` 처리가 필요해지면 연결한다.
- `estimateService.ts`의 우회 검사 주석(121, 257행)이 "배치가 아직 없어서"로 남아 있어 수정이 필요하다.
- Notification 도입 시 advisory lock 적용 (4-6).

**배운 점**

- 구현된 함수가 "어디서 호출되는지"까지 확인해야 기능이 완성된다.
- 인프로세스 스케줄러는 간단하지만 에러 격리, 시간대, 중복 실행, 다중 인스턴스를 직접 챙겨야 한다.
