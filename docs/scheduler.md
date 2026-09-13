# 스케줄러 (이사일 경과 견적 요청 정리)

이사일이 지난 견적 요청의 상태를 주기적으로 정리하는 배치다.

> **적용 전 검토용 문서다.** 코드는 작성돼 있으나 아직 `dev`에 머지되지 않았다.
> 아래 [7. 적용 전 확인 사항](#7-적용-전-확인-사항)을 먼저 읽고 결정한다.

## 1. 왜 필요한가

`estimateRequestRepository.closePastEstimateRequests()`는 이미 구현돼 있었지만
**호출하는 곳이 아무 데도 없었다.** 서비스가 래핑만 하고 스케줄러도 라우트도 붙지 않은 상태였다.

그 결과 `EstimateRequest`가 영구히 `PENDING` / `CONFIRMED`에 머물고, 다음 기능이 전부 동작하지 않았다.

| 영향                                          | 근거                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 고객이 **두 번째 견적 요청을 넣을 수 없음**   | `schema.prisma`의 부분 유니크 인덱스가 `status IN ('PENDING','CONFIRMED')`를 1건으로 제한 |
| **리뷰 작성 불가**                            | `reviewService.createReview`가 `estimateRequest.status === 'COMPLETED'`를 요구            |
| `GET /reviews/me` 항상 빈 배열                | `where.estimateRequest.status = 'COMPLETED'`                                              |
| `GET /estimate-requests/history` 항상 빈 배열 | `status IN ('COMPLETED','EXPIRED')`만 조회                                                |

`estimateService.updateEstimateStatus`에 "자동 전환 배치가 아직 없어서" `moveDate`를 별도로
검사하는 우회 코드가 남아 있는 것도 같은 원인이다.

## 2. 배치가 하는 일

기존 `closePastEstimateRequests()`를 **그대로** 호출한다. 로직은 손대지 않았다.

`moveDate < now` 이면서 아직 열려 있는 요청을 한 트랜잭션 안에서 정리한다.

| 대상                                                             | 전환                         |
| ---------------------------------------------------------------- | ---------------------------- |
| `EstimateRequest.status = CONFIRMED`                             | → `COMPLETED` (이사 완료)    |
| `EstimateRequest.status = PENDING`                               | → `EXPIRED` (확정 없이 경과) |
| 만료된 요청의 `Estimate.status IN (PROPOSED, DESIGNATED)`        | → `EXPIRED`                  |
| 처리된 요청을 가리키던 `CustomerProfile.activeEstimateRequestId` | → `null`                     |

`REJECTED`(반려)는 이미 종료된 상태라 그대로 둔다.

반환값은 `{ completed, expired, expiredEstimates }`다.

## 3. 구현 내용

### 3-1. 왜 `node-cron`인가

| 후보                     | 판단                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| **`node-cron@4.6.0`** ✅ | 의존성 0개, 타입 내장(`@types/*` 불필요), `timezone`·`noOverlap` 네이티브 지원 |
| `croner@10`              | 조건은 동일하고 DST 처리가 더 견고. 한국은 서머타임이 없어 실질 차이 없음      |
| BullMQ + Redis           | 잡 1개에 Redis를 추가할 이유가 없음                                            |
| `pg_cron`                | 관리형 Postgres 무료 티어에서 보통 설치 불가                                   |

### 3-2. 파일 구조

```
src/scheduler/
├─ index.ts                          등록/해제만. startScheduler() / stopScheduler()
└─ closePastEstimateRequestsJob.ts   잡 본체 — 서비스 호출 + 로깅
src/scripts/
└─ closePastEstimateRequests.ts      같은 잡을 1회 실행하는 CLI 진입점
```

**등록부(`index.ts`)와 잡(`*Job.ts`)을 나눈 이유**는 CLI와 스케줄러가 `runClosePastEstimateRequests()`
하나를 공유하게 만들기 위해서다. 나중에 플랫폼 Cron으로 옮겨도 잡 코드는 그대로 재사용된다.

비즈니스 규칙은 기존대로 `estimateRequestService`에 있다. 스케줄러 계층에는 두지 않았다.

### 3-3. 변경된 파일

| 파일                                            | 변경                                                  |
| ----------------------------------------------- | ----------------------------------------------------- |
| `src/scheduler/closePastEstimateRequestsJob.ts` | 신규 — 잡 본체                                        |
| `src/scheduler/index.ts`                        | 신규 — cron 등록/해제                                 |
| `src/scripts/closePastEstimateRequests.ts`      | 신규 — CLI 진입점                                     |
| `src/config/env.ts`                             | `SCHEDULER_*` 3개 추가 + `toBoolean` 헬퍼             |
| `src/server.ts`                                 | `listen` 콜백에서 `startScheduler()` 호출             |
| `package.json`                                  | `node-cron` 의존성, `job:close-requests` 스크립트 2개 |

### 3-4. 설계 판단 4가지

**① `listen` 콜백 안에서 기동한다**
포트가 열린 뒤에 배치를 등록해야, 첫 배치가 도는 동안에도 헬스체크와 요청 처리가 가능하다.

**② 잡 에러를 삼키고 로깅만 한다**
cron 콜백에서 에러가 새어 나가면 `unhandledRejection`으로 프로세스가 죽는다.
배치 1회 실패가 API 서버 전체를 내리면 안 되므로 `runSafely`가 잡아서 로깅하고 다음 주기를 기다린다.

**③ `noOverlap: true`**
이전 실행이 다음 주기까지 안 끝났으면 이번 주기를 건너뛴다. node-cron이 제공하는 옵션이라
직접 플래그를 만들지 않았다. **단, 한 프로세스 안에서의 중복만 막는다.**

**④ 처리 건수가 0이어도 로그를 남긴다**
"배치가 멈춘 것"과 "처리할 대상이 없는 것"은 로그로만 구분된다.

### 3-5. 환경변수

셋 다 **선택값**이고 기본값으로 동작한다. `.env*`를 바꾸지 않아도 된다.

| 키                              | 기본값       | 설명                                          |
| ------------------------------- | ------------ | --------------------------------------------- |
| `SCHEDULER_ENABLED`             | `true`       | `false`면 인프로세스 스케줄러를 띄우지 않는다 |
| `SCHEDULER_CLOSE_REQUESTS_CRON` | `0 * * * *`  | 실행 주기 (매시 정각)                         |
| `SCHEDULER_TIMEZONE`            | `Asia/Seoul` | cron 표현식 해석 기준 시간대                  |

`SCHEDULER_ENABLED`는 `'false'`와 `'0'`만 거짓으로 본다. 그 외 값은 참이다.

**주기를 매시로 잡은 이유:** `moveDate`는 날짜가 아니라 `DateTime`이다. 일 1회로 두면
이사일이 지난 뒤 최대 24시간 동안 요청이 `PENDING`에 묶여 고객이 새 견적 요청을 못 넣는다.
대상이 없으면 쿼리 1번으로 끝나므로 매시 실행 비용은 거의 없다.

시작 시 `cron.validate()`로 표현식을 검증하고, 잘못된 값이면 **서버를 띄우지 않고 즉시 실패**한다.
오타 난 표현식으로 배치가 조용히 안 도는 상황을 막기 위해서다.

## 4. 실행 방법

### 4-1. 개발 서버 (자동)

```bash
npm run dev
```

기동 로그에 다음 줄이 찍히면 정상이다.

```
서버 포트 3000 env 설정 : (development)
[scheduler] closePastEstimateRequests 등록 — "0 * * * *" (Asia/Seoul)
```

매시 정각마다 실행 결과가 찍힌다.

```
[scheduler] closePastEstimateRequests 완료 — 완료 2건, 만료 1건, 만료된 견적 3건 (48ms)
```

### 4-2. 즉시 1회 실행 (CLI)

주기를 기다리지 않고 바로 돌린다.

```bash
npm run job:close-requests
```

프로덕션 DB 대상:

```bash
npm run job:close-requests:prod
```

종료 코드는 성공 `0`, 실패 `1`이다. 처리 건수가 0이어도 성공이다.

### 4-3. 주기 바꿔서 테스트

`.env.development`에 추가하면 1분마다 돈다.

```
SCHEDULER_CLOSE_REQUESTS_CRON=* * * * *
```

### 4-4. 스케줄러 끄기

```
SCHEDULER_ENABLED=false
```

```
[scheduler] SCHEDULER_ENABLED=false — 스케줄러를 띄우지 않는다.
```

## 5. 검증 결과

| 항목                                   | 결과                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `npx tsc --noEmit` — 신규 파일         | 에러 0                                                  |
| `npx eslint src/scheduler src/scripts` | 에러 0, 경고 0                                          |
| 스케줄러 등록 + 다음 실행 시각         | 통과 — `0 * * * *` / `Asia/Seoul`로 매시 정각 계산 확인 |
| `stopScheduler()` 정리                 | 통과 — 등록 작업 수 1 → 0                               |
| `SCHEDULER_ENABLED=false`              | 통과 — 작업 0개 등록                                    |
| 잘못된 cron 표현식                     | 통과 — 기동 시 즉시 `Error`                             |
| **배치 본체 실제 실행**                | ⚠️ **미검증**                                           |

배치 본체를 DB에 대고 돌려보지 못했다. `.env.development`의 `DATABASE_URL` 자격증명이
인증에 실패한다 (`Authentication failed against the database server`).
**머지 전에 유효한 개발 DB로 [6. 동작 확인 절차](#6-동작-확인-절차)를 반드시 한 번 수행해야 한다.**

## 6. 동작 확인 절차

개발 DB 자격증명을 복구한 뒤 진행한다.

```bash
# 1) 시드 데이터 투입
npm run db:seed

# 2) 배치 전 상태 확인 — 이사일이 지났는데 아직 열려 있는 요청
npm run db:studio
#    estimateRequest 테이블에서 moveDate < 오늘 이고 status가 PENDING/CONFIRMED인 행을 센다

# 3) 배치 1회 실행
npm run job:close-requests

# 4) 로그의 완료/만료 건수가 2)에서 센 수와 일치하는지 확인

# 5) 같은 명령을 한 번 더 실행 → 멱등성 확인 (완료 0건, 만료 0건이어야 한다)
```

이어서 배치가 풀어준 기능이 실제로 살아났는지 확인한다.

- `GET /estimate-requests/history` 가 지난 이사 이력을 반환하는가
- 활성 요청이 정리된 고객이 `POST /estimate-requests` 로 새 요청을 넣을 수 있는가
- `GET /reviews/me` 가 리뷰 작성 가능 견적을 반환하는가

## 7. 적용 전 확인 사항

### 7-1. `src/app.ts` 빌드 오류를 먼저 고쳐야 한다

현재 `dev` 기준으로 `npm run build`가 실패한다. 이 스케줄러와는 무관한 기존 문제다.

```
src/app.ts(2,8): error TS2300: Duplicate identifier 'path'.
src/app.ts(4,8): error TS2300: Duplicate identifier 'path'.
```

`import path from 'path'`(4행)과 중복된 `/uploads` static 등록(30행)을 지우면 된다.
**이 문서의 작업에는 포함하지 않았다.** 별도 이슈/PR로 처리한다.

### 7-2. 다중 인스턴스 배포 시 중복 실행

인프로세스 스케줄러는 서버가 2대 뜨면 배치가 2번 돈다.

**지금은 무해하다.** 배치가 멱등해서 조건에 맞는 행을 같은 값으로 UPDATE 하고,
두 번째 실행은 대상 0건으로 끝난다.

**Notification 도메인이 붙으면 무해하지 않다.** `MOVE_DAY` 알림을 보내기 시작하면
알림이 인스턴스 수만큼 중복 발송된다. 그 시점에 Postgres advisory lock으로 감싼다.
Redis 없이 기존 `pg` 연결만으로 된다.

```ts
// estimateRequestRepository.closePastEstimateRequests()의 트랜잭션 맨 앞
const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
  SELECT pg_try_advisory_xact_lock(918273) AS locked
`;
if (!locked) {
  // 다른 인스턴스가 이미 실행 중이다. 이번 주기는 넘긴다.
  return { completed: 0, expired: 0, expiredEstimates: 0 };
}
```

### 7-3. 서버리스 / 스케일아웃 배포로 간다면

인프로세스 스케줄러는 쓸 수 없다. 다음과 같이 전환한다.

1. `SCHEDULER_ENABLED=false`
2. 플랫폼 Cron Job(Render / Railway / GitHub Actions)이 `npm run job:close-requests:prod` 호출

`src/scripts/`를 따로 둔 것이 이 전환을 위해서다. **잡 코드는 한 줄도 바뀌지 않는다.**

### 7-4. 배포 직후 밀린 데이터

이 배치가 처음 도는 순간, 그동안 쌓인 과거 요청이 **한꺼번에** 정리된다.
운영 DB 규모에 따라 첫 실행이 길어질 수 있으니 배포 직후 CLI로 한 번 수동 실행하고
로그를 확인하는 편이 안전하다.

## 8. 관련 파일

| 경로                                                        | 역할                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| `src/scheduler/index.ts`                                    | cron 등록/해제                                |
| `src/scheduler/closePastEstimateRequestsJob.ts`             | 잡 본체                                       |
| `src/scripts/closePastEstimateRequests.ts`                  | CLI 진입점                                    |
| `src/modules/estimate-request/estimateRequestService.ts`    | `closePastEstimateRequests()` — 비즈니스 로직 |
| `src/modules/estimate-request/estimateRequestRepository.ts` | 트랜잭션 본체                                 |
| `src/config/env.ts`                                         | `SCHEDULER_*` 설정                            |
