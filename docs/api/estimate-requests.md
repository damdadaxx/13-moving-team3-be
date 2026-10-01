# 견적 요청 API (`/estimate-requests`)

일반 유저(CUSTOMER)가 견적을 요청하고, 받은 견적과 지난 이사 이력을 확인하는 API다.

Swagger 문서는 `src/docs/estimateRequestSwagger.ts`에 있고 서버 실행 후 `/api-docs`에서 볼 수 있다.

## 공통 사항

| 항목      | 내용                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| Base path | `/estimate-requests` (`src/app.ts`에서 마운트)                                       |
| 인증      | 필수. `accessToken` HttpOnly 쿠키 (라우터 전체에 `authenticate` 적용)                |
| 권한      | `CUSTOMER` 전용. MOVER 토큰으로 호출하면 403                                         |
| 성공 응답 | `{ "success": true, "data": ... }`                                                   |
| 실패 응답 | `{ "path", "method", "message", "date" }` (검증 실패는 `message` 대신 `errors` 배열) |

### 엔드포인트

| Method | Path                                              | 설명                                 |
| ------ | ------------------------------------------------- | ------------------------------------ |
| POST   | `/estimate-requests`                              | 견적 요청 생성                       |
| GET    | `/estimate-requests/active`                       | 진행 중인 견적 요청 + 받은 견적 목록 |
| GET    | `/estimate-requests/history`                      | 지난 이사 이력 (커서 무한 스크롤)    |
| POST   | `/estimate-requests/:estimateRequestId/estimates` | 특정 기사님에게 지정 견적 요청       |

### 모듈 구성

```
src/modules/estimate-request/
├─ estimateRequestRoute.ts       경로 + 미들웨어 연결
├─ estimateRequestSchema.ts      Zod 검증 스키마
├─ estimateRequestController.ts  인증 payload 추출, service 위임, 응답 조립
├─ estimateRequestService.ts     비즈니스 규칙, Prisma 에러 → 도메인 에러 변환
└─ estimateRequestRepository.ts  Prisma 조회/생성, 트랜잭션
src/docs/estimateRequestSwagger.ts   Swagger 주석
```

### 검증 실패 응답 형식

```json
{
  "path": "/estimate-requests",
  "method": "POST",
  "errors": [
    {
      "field": "serviceType",
      "message": "serviceType은 SMALL_MOVE, HOME_MOVE, OFFICE_MOVE 중 하나여야 합니다."
    },
    {
      "field": "moveDate",
      "message": "moveDate는 올바른 날짜 형식이어야 합니다."
    }
  ],
  "date": "2026-09-08T05:05:04.342Z"
}
```

---

## 1. 견적 요청 생성

```
POST /estimate-requests
```

진행 중인 견적 요청을 만든다. 생성과 동시에 `customerProfile.activeEstimateRequestId`가 이 요청으로 연결된다.

### Request Body

| 필드               | 타입        | 필수 | 규칙                                         |
| ------------------ | ----------- | ---- | -------------------------------------------- |
| `serviceType`      | string      | O    | `SMALL_MOVE` \| `HOME_MOVE` \| `OFFICE_MOVE` |
| `moveDate`         | string(ISO) | O    | 오늘 이후 날짜만 허용                        |
| `departureZipCode` | **string**  | O    | 5자리 숫자 문자열 (`^\d{5}$`)                |
| `departureAddress` | string      | O    | 5 ~ 200자                                    |
| `arrivalZipCode`   | **string**  | O    | 5자리 숫자 문자열 (`^\d{5}$`)                |
| `arrivalAddress`   | string      | O    | 5 ~ 200자                                    |

> **우편번호는 숫자가 아니라 문자열이다.** `"04524"`처럼 0으로 시작하는 번호를 보존하기 위해서다. JSON 숫자 리터럴에는 앞자리 0을 쓸 수 없고(`04524`는 파싱 에러), 숫자로 보내면 400이 난다.

```json
{
  "serviceType": "HOME_MOVE",
  "moveDate": "2026-11-20T00:00:00.000Z",
  "departureZipCode": "21556",
  "departureAddress": "인천광역시 남동구 예술로 149 201동 1102호",
  "arrivalZipCode": "06035",
  "arrivalAddress": "서울특별시 강남구 가로수길 5 201호"
}
```

### 호출 순서

| #   | 파일                           | 하는 일                                                           |
| --- | ------------------------------ | ----------------------------------------------------------------- |
| 1   | `src/app.ts`                   | `app.use('/estimate-requests', estimateRequestRouter)`            |
| 2   | `estimateRequestRoute.ts`      | `router.use(authenticate)`                                        |
| 3   | `middlewares/authenticate.ts`  | 쿠키의 accessToken 검증 → `req.auth` 주입                         |
| 4   | `estimateRequestRoute.ts`      | `validate(createEstimateRequestSchema)`                           |
| 5   | `middlewares/validation.ts`    | `safeParse(req.body)` → `req.validatedData`                       |
| 6   | `estimateRequestController.ts` | `create` — `getCustomerId(req)`로 CUSTOMER 확인                   |
| 7   | `estimateRequestService.ts`    | `create` — 이사일 재검증, P2002 → `ConflictError` 변환            |
| 8   | `estimateRequestRepository.ts` | `createEstimateRequest` — 트랜잭션으로 요청 생성 + 활성 요청 연결 |
| 9   | `estimateRequestRepository.ts` | `attachMoverStats` — 조회 API와 반환 구조를 맞춤                  |
| 10  | `estimateRequestController.ts` | `success(res, data, 201)`                                         |

8번의 트랜잭션은 요청 생성과 프로필의 활성 요청 연결을 함께 처리한다. 둘 중 하나만 성공하면 요청은 DB에 있는데 화면에는 안 보이는 상태가 되므로 반드시 묶여야 한다.

### Response `201`

```json
{
  "success": true,
  "data": {
    "id": "c25b7b42-d6aa-4ed0-98ff-fe71461b372c",
    "customerId": "20000000-0000-4000-8000-000000000003",
    "serviceType": "HOME_MOVE",
    "moveDate": "2026-11-20T00:00:00.000Z",
    "departureAddress": "인천광역시 남동구 예술로 149 201동 1102호",
    "arrivalAddress": "서울특별시 강남구 가로수길 5 201호",
    "status": "PENDING",
    "estimates": []
  }
}
```

생성 직후라 `estimates`는 빈 배열이고 `status`는 항상 `PENDING`이다. **응답에 우편번호는 포함되지 않는다.**

### 에러

| 상태 | message                                                                |
| ---- | ---------------------------------------------------------------------- |
| 400  | `이사일은 오늘 이후로 선택해 주세요.`                                  |
| 400  | `departureZipCode는 5자리 숫자 문자열이어야 합니다.`                   |
| 400  | `serviceType은 SMALL_MOVE, HOME_MOVE, OFFICE_MOVE 중 하나여야 합니다.` |
| 403  | `일반 유저만 이용할 수 있는 기능입니다.`                               |
| 409  | `이미 진행 중인 견적 요청이 있습니다.`                                 |

409는 부분 유니크 인덱스(`estimateRequest_customerId_active_key`)로 고객당 진행 중인 요청이 1건만 허용되기 때문이다. 이사일이 지나 배치가 정리하기 전까지는 새 요청을 만들 수 없다.

---

## 2. 진행 중인 견적 요청 조회

```
GET /estimate-requests/active
```

로그인한 고객의 진행 중(`PENDING` / `CONFIRMED`) 요청을 받은 견적과 함께 반환한다.

경로에 id를 받지 않는다. 고객당 진행 중인 요청은 최대 1건이 DB 제약으로 보장되므로 인증 정보의 `customerId`만으로 조회가 끝난다. 남의 요청 id를 넘겨볼 경로 자체가 없다.

### Request

파라미터 없음.

### 호출 순서

| #   | 파일                           | 하는 일                                                   |
| --- | ------------------------------ | --------------------------------------------------------- |
| 1   | `src/app.ts`                   | 라우터 마운트                                             |
| 2   | `middlewares/authenticate.ts`  | 토큰 검증 → `req.auth`                                    |
| 3   | `estimateRequestController.ts` | `getActive` — CUSTOMER 확인                               |
| 4   | `estimateRequestService.ts`    | `getActive` — repository 위임                             |
| 5   | `estimateRequestRepository.ts` | `findActiveByCustomerId` — 요청 + 견적 + 기사님 정보 조회 |
| 6   | `estimateRequestRepository.ts` | `attachMoverStats` — 평점 평균을 `groupBy`로 조회해 병합  |
| 7   | `estimateRequestController.ts` | `success(res, data)`                                      |

검증 미들웨어가 없는 유일한 엔드포인트다. 입력값이 없기 때문이다.

> 견적이 몇 건이든 DB 쿼리는 **2회**다. 리뷰 수·확정 건수·찜 수는 `_count`로 함께 집계하고, 평점 평균만 `groupBy` 1회로 가져온다.

### Response `200`

```json
{
  "success": true,
  "data": {
    "id": "c25b7b42-d6aa-4ed0-98ff-fe71461b372c",
    "customerId": "20000000-0000-4000-8000-000000000003",
    "serviceType": "HOME_MOVE",
    "moveDate": "2026-11-20T00:00:00.000Z",
    "departureAddress": "인천광역시 남동구 예술로 149 201동 1102호",
    "arrivalAddress": "서울특별시 강남구 가로수길 5 201호",
    "status": "PENDING",
    "estimates": [
      {
        "id": "91b4e06c-6b02-4f3a-8fc9-b17ccb9e3c32",
        "price": null,
        "comment": null,
        "isDesignated": true,
        "status": "DESIGNATED",
        "rejectReason": null,
        "mover": {
          "userId": "10000000-0000-4000-8000-000000000005",
          "nickname": "하늘 프리미엄무빙",
          "imgUrl": "https://picsum.photos/seed/mover-haneul/240/240",
          "careerMonths": 182,
          "user": { "name": "정하늘" },
          "reviewCount": 3,
          "averageRating": 4.7,
          "confirmedEstimateCount": 3,
          "likeCount": 4
        }
      }
    ]
  }
}
```

**진행 중인 요청이 없으면 404가 아니라 `200 + data: null`이다.** 아직 견적을 요청하지 않은 고객은 오류 상황이 아니라 정상적인 빈 상태이기 때문이다.

```json
{ "success": true, "data": null }
```

### 필드 설명

| 필드                           | 설명                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `status`                       | `PENDING`(견적 대기) 또는 `CONFIRMED`(확정 완료, 이사일 대기)                    |
| `estimates[].price`            | 금액 미입력(`DESIGNATED`)·반려(`REJECTED`) 건은 `null`                           |
| `estimates[].status`           | `PROPOSED` / `DESIGNATED` / `REJECTED` / `ACCEPTED` / `NOT_SELECTED` / `EXPIRED` |
| `estimates[].isDesignated`     | 고객이 기사님을 지정해 요청한 견적인지                                           |
| `estimates[].rejectReason`     | 기사님이 지정 견적을 반려한 사유 (그 외에는 `null`)                              |
| `mover.userId`                 | 기사님 식별자. 상세 이동·찜 토글·지정 견적 요청에 사용                           |
| `mover.averageRating`          | 평점 평균(소수점 첫째 자리 반올림). **리뷰가 없으면 `null`** (0이 아님)          |
| `mover.reviewCount`            | 받은 리뷰 총 개수                                                                |
| `mover.confirmedEstimateCount` | 확정(`ACCEPTED`)받은 견적의 **누적** 총 건수. 이 요청 한정이 아님                |
| `mover.likeCount`              | 찜 받은 수                                                                       |

정렬은 견적 생성 최신순(`createdAt desc`)이다. 반려·금액 미입력 건도 그대로 내려가므로 화면에서 필요에 따라 걸러야 한다.

---

## 3. 이사 이력 목록

```
GET /estimate-requests/history?cursor=&limit=
```

이사일이 지난 요청(`COMPLETED` / `EXPIRED`)만 최신순으로 반환한다. 진행 중인 요청은 포함되지 않는다 — 그건 `/active`가 담당한다.

### Query

| 필드     | 타입         | 필수 | 규칙                                             |
| -------- | ------------ | ---- | ------------------------------------------------ |
| `cursor` | string(uuid) | X    | 직전 페이지 마지막 요청의 `id`. 첫 페이지는 생략 |
| `limit`  | number       | X    | 1 ~ 50. 기본값 4                                 |

> **빈 문자열을 보내면 400이다.** `?cursor=&limit=`처럼 값 없이 키만 붙이면 검증에 걸린다. 값이 없을 때는 파라미터 자체를 빼야 한다.

### 호출 순서

| #   | 파일                           | 하는 일                                                             |
| --- | ------------------------------ | ------------------------------------------------------------------- |
| 1   | `src/app.ts`                   | 라우터 마운트                                                       |
| 2   | `middlewares/authenticate.ts`  | 토큰 검증 → `req.auth`                                              |
| 3   | `estimateRequestRoute.ts`      | `validate(historyQuerySchema, 'query')`                             |
| 4   | `middlewares/validation.ts`    | `safeParse(req.query)` → `req.validatedData`                        |
| 5   | `estimateRequestController.ts` | `getHistory` — CUSTOMER 확인, cursor/limit 추출                     |
| 6   | `estimateRequestService.ts`    | `getHistory` — `limit`을 1~50으로 클램프                            |
| 7   | `estimateRequestRepository.ts` | `findByEstimateUserId` — `take: limit + 1`로 다음 페이지 유무 판별  |
| 8   | `estimateRequestRepository.ts` | `attachMoverStats` — 페이지 전체 기사님 평점을 `groupBy` 1회로 병합 |
| 9   | `estimateRequestController.ts` | `success(res, data)`                                                |

`limit` 상한은 스키마와 service 두 곳에 있다. 중복이지만 service를 다른 경로에서 직접 호출할 때를 대비한 것이다.

### Response `200`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000006",
        "customerId": "20000000-0000-4000-8000-000000000001",
        "serviceType": "SMALL_MOVE",
        "moveDate": "2026-05-07T09:23:55.073Z",
        "departureAddress": "서울특별시 서대문구 연희로 25 401호",
        "arrivalAddress": "서울특별시 중구 세종대로 110 3층",
        "status": "COMPLETED",
        "estimates": [
          {
            "id": "40000000-0000-4000-8000-000000000013",
            "price": 260000,
            "comment": "짐이 많지 않아 1톤 차량으로 충분합니다.",
            "isDesignated": false,
            "status": "ACCEPTED",
            "rejectReason": null,
            "mover": {
              "userId": "10000000-0000-4000-8000-000000000001",
              "nickname": "민재 이사센터",
              "imgUrl": "https://picsum.photos/seed/mover-minjae/240/240",
              "careerMonths": 98,
              "user": { "name": "김민재" },
              "reviewCount": 1,
              "averageRating": 5,
              "confirmedEstimateCount": 2,
              "likeCount": 2
            }
          }
        ]
      }
    ],
    "nextCursor": "30000000-0000-4000-8000-000000000006",
    "hasNext": true
  }
}
```

`items[]`의 원소 구조는 `/active`의 `data`와 동일하다. 필드 설명은 2번 항목 참고.

| 필드         | 설명                                                   |
| ------------ | ------------------------------------------------------ |
| `items`      | 요청 배열. 이력이 없으면 빈 배열                       |
| `nextCursor` | 다음 페이지 요청에 쓸 커서. 마지막 페이지에서는 `null` |
| `hasNext`    | 다음 페이지 존재 여부                                  |

### 페이지네이션 사용법

1. 첫 요청: `GET /estimate-requests/history?limit=10`
2. `hasNext`가 `true`면 `nextCursor`를 그대로 다음 요청의 `cursor`로 전달
3. `GET /estimate-requests/history?limit=10&cursor=<nextCursor>`
4. `hasNext`가 `false`가 될 때까지 반복 (이때 `nextCursor`는 항상 `null`)

`hasNext`와 `nextCursor`는 항상 함께 움직이므로 둘 중 하나만 확인해도 된다.

내부적으로 `limit + 1`건을 읽어 한 건이 더 있으면 `hasNext: true`로 판단하고 응답에서는 잘라낸다. 별도 `count` 쿼리가 없어 무한 스크롤에 적합하다.

정렬은 `createdAt desc, id desc`다. 같은 시각에 생성된 요청이 있어도 순서가 흔들리지 않도록 `id`를 2차 정렬로 둔다 — 커서 페이지네이션에서 정렬이 불안정하면 항목이 중복되거나 누락된다.

### 에러

| 상태 | message                                  |
| ---- | ---------------------------------------- |
| 400  | `limit은 50 이하여야 합니다.`            |
| 400  | `limit은 1 이상이어야 합니다.`           |
| 400  | `limit은 숫자여야 합니다.`               |
| 400  | `cursor 형식이 올바르지 않습니다.`       |
| 403  | `일반 유저만 이용할 수 있는 기능입니다.` |

---

## 4. 지정 견적 요청

```
POST /estimate-requests/:estimateRequestId/estimates
```

특정 기사님을 지정해 견적을 요청한다. 요청 1건당 **최대 3명**까지 지정할 수 있다.

### Path Parameter

| 필드                | 타입         | 규칙                     |
| ------------------- | ------------ | ------------------------ |
| `estimateRequestId` | string(uuid) | 본인의 진행 중인 요청 id |

### Request Body

| 필드      | 타입         | 필수 | 규칙                     |
| --------- | ------------ | ---- | ------------------------ |
| `moverId` | string(uuid) | O    | 지정할 기사님의 `userId` |

```json
{ "moverId": "10000000-0000-4000-8000-000000000005" }
```

`moverId`는 `/active` 응답이나 기사님 목록의 `mover.userId` 값을 그대로 쓴다.

### 호출 순서

| #   | 파일                           | 하는 일                                                                     |
| --- | ------------------------------ | --------------------------------------------------------------------------- |
| 1   | `src/app.ts`                   | 라우터 마운트                                                               |
| 2   | `middlewares/authenticate.ts`  | 토큰 검증 → `req.auth`                                                      |
| 3   | `estimateRequestRoute.ts`      | `validate(estimateRequestIdParamSchema, 'params')`                          |
| 4   | `estimateRequestRoute.ts`      | `validate(createDesignatedEstimateSchema)` — body                           |
| 5   | `estimateRequestController.ts` | `createDesignated` — CUSTOMER 확인                                          |
| 6   | `estimateRequestService.ts`    | `findActiveByCustomerId`로 ① 요청 존재 ② 본인 소유 ③ `PENDING` 상태 검증    |
| 7   | `estimateRequestRepository.ts` | `createDirectEstimateRequest` — 트랜잭션 안에서 지정 견적 개수 확인 후 생성 |
| 8   | `estimateRequestService.ts`    | P2002 → `ConflictError`, P2003 → `NotFoundError` 변환                       |
| 9   | `estimateRequestController.ts` | `success(res, data, 201)`                                                   |

> **3번과 4번의 순서가 중요하다.** `validate`는 `req.validatedData`를 덮어쓰므로 컨트롤러가 읽을 body 검증이 마지막에 와야 한다. 순서를 바꾸면 `moverId`가 `undefined`가 된다.

생성되는 견적은 `isDesignated: true`, `status: 'DESIGNATED'`, `price: null` 고정이다. 금액은 기사님이 나중에 채운다.

### Response `201`

```json
{
  "success": true,
  "data": {
    "id": "91b4e06c-6b02-4f3a-8fc9-b17ccb9e3c32",
    "isDesignated": true,
    "status": "DESIGNATED",
    "mover": {
      "userId": "10000000-0000-4000-8000-000000000005",
      "nickname": "하늘 프리미엄무빙",
      "user": { "name": "정하늘" }
    }
  }
}
```

조회 API보다 응답이 가볍다. 방금 만든 견적은 금액도 코멘트도 없어서 기사님 식별 정보만 돌려준다. 목록을 갱신하려면 `/active`를 다시 호출한다.

### 에러

| 상태 | message                                                       | 조건                                          |
| ---- | ------------------------------------------------------------- | --------------------------------------------- |
| 400  | `estimateRequestId 형식이 올바르지 않습니다.`                 | uuid 아님                                     |
| 400  | `moverId 형식이 올바르지 않습니다.`                           | 누락 또는 uuid 아님                           |
| 400  | `이미 견적을 확정한 요청에는 지정 견적을 요청할 수 없습니다.` | 요청이 `CONFIRMED` 상태                       |
| 403  | `본인의 견적 요청에만 접근할 수 있습니다.`                    | 남의 요청 id                                  |
| 403  | `일반 유저만 이용할 수 있는 기능입니다.`                      | MOVER 토큰                                    |
| 404  | `진행 중인 견적 요청이 없습니다.`                             | 활성 요청 없음                                |
| 404  | `해당 기사님을 찾을 수 없습니다.`                             | `moverId`에 기사님 프로필이 없음(P2003)       |
| 409  | `이미 지정 견적을 요청한 기사님입니다.`                       | `@@unique([estimateRequestId, moverId])` 위반 |
| 409  | `지정 견적 요청은 최대 3건까지 가능합니다.`                   | 상한 초과                                     |

`moverId`에 일반 유저의 id를 넣은 경우도 404다. 기사님 프로필이 없다는 점에서 같은 상황이라 메시지를 나누지 않았다.

### 알아둘 점

- **반려(`REJECTED`)된 지정 견적도 3건에 포함된다.** 기사님이 거절해도 슬롯이 반환되지 않는다. 슬롯을 돌려주려면 개수 집계 조건에 `status: { not: 'REJECTED' }`를 추가해야 한다.
- **반려한 기사님에게는 재요청할 수 없다.** 유니크 제약에 걸려 409가 난다.
- 상한 검사는 트랜잭션 안에서 하지만, 기본 격리 수준(READ COMMITTED)에서 `count`는 락을 잡지 않는다. 동시 요청이 겹치면 이론적으로 3건을 넘길 수 있다. 엄격히 막으려면 `isolationLevel: 'Serializable'` 또는 부모 행 `SELECT ... FOR UPDATE`가 필요하다.

---

## 부록 A. 이사일 경과 처리 (배치)

```ts
estimateRequestRepository.closePastEstimateRequests(now?: Date)
```

HTTP 엔드포인트가 아니라 스케줄러에서 주기적으로 호출하는 함수다. **아직 호출부가 없어 수동 실행 외에는 동작하지 않는다.**

한 트랜잭션에서 다음을 모두 처리한다.

| 대상                                                             | 처리                            |
| ---------------------------------------------------------------- | ------------------------------- |
| `CONFIRMED` 요청                                                 | → `COMPLETED`                   |
| `PENDING` 요청                                                   | → `EXPIRED`                     |
| 만료된 요청의 `PROPOSED` / `DESIGNATED` 견적                     | → `EXPIRED` (`REJECTED`는 유지) |
| 처리된 요청을 가리키던 `customerProfile.activeEstimateRequestId` | → `null`                        |

반환값은 `{ completed, expired, expiredEstimates }`이며, 대상이 없으면 `{ completed: 0, expired: 0, expiredEstimates: 0 }`이다.

상태만 바뀌고 `activeEstimateRequestId`가 남으면 그 고객은 새 견적 요청을 만들 수 없게 되므로 반드시 함께 처리되어야 한다. 이미 `COMPLETED` / `EXPIRED`인 요청은 조회 조건에서 제외되므로 여러 번 실행해도 안전하다(멱등).

---

## 부록 B. 알려진 이슈

이 모듈 밖(공용 코드)에 원인이 있어 아직 고치지 않은 것들이다.

| 증상                                        | 원인                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 인증 쿠키 없음 / 만료 시 **401이 아닌 500** | `express-jwt`의 `UnauthorizedError`가 `AppError`가 아니라 `errorHandler`의 500 분기로 떨어짐 |
| 깨진 JSON 전송 시 **400이 아닌 500**        | `body-parser`의 `entity.parse.failed` 에러도 같은 이유로 500                                 |
| 없는 경로가 **JSON이 아닌 HTML 404**        | `app.ts`에 404 핸들러가 없어 Express 기본 응답이 나감                                        |

앞의 두 건은 `errorHandler`에 `status` 속성을 가진 외부 라이브러리 에러를 처리하는 분기를 추가하면 함께 해결된다.
