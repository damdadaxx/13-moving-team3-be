![alt text](/attachment/intro.png)

# 🚚 무빙 (Moving)

# 이사 소비자와 이사 전문가 매칭 서비스

- 서비스 주소: [moving-team3.xyz](https://moving-team3.xyz)
- Frontend: [13-moving-team3-fe](https://github.com/damdadaxx/13-moving-team3-fe)
- Backend: [13-moving-team3-be](https://github.com/damdadaxx/13-moving-team3-be)

# 📜 목차

1. [프로젝트 소개](#-프로젝트-소개)
2. [기능 시연 영상](#-고객-기능-시연-영상)
3. [시스템 아키텍처](#-시스템-아키텍처)
4. [기술 스택](#️-기술-스택)
5. [주요 라이브러리](#-주요-라이브러리)
6. [팀 소개 및 문서](#-팀-소개-및-문서)
7. [개인별 주요 작업 내역](#-개인별-주요-작업-내역)
8. [프로젝트 구조](#-프로젝트-구조)
9. [주요 기능 상세](#-주요-기능-상세)
10. [성능 최적화 전략](#-성능-최적화-전략)
11. [트러블 슈팅](#-트러블-슈팅)
12. [실행 방법](#️-실행-방법)

<br/>

# 📝 프로젝트 소개

- 이사 소비자와 이사 전문가(기사님)를 연결하는 **견적 매칭 플랫폼**의 백엔드 API 서버입니다.
  고객이 이사 조건으로 견적을 요청하면, 서비스 가능 지역·서비스 유형이 맞는 기사님이 견적을 보내고, 고객은 견적을 비교해 확정합니다.
  확정 이후에는 1:1 채팅, 이사 완료 후 리뷰 작성(AI 초안 지원)까지 하나의 흐름으로 이어집니다.

<br/>

# 💻 고객 기능 시연 영상

[![무빙 고객 기능 시연 영상](https://img.youtube.com/vi/DfR7eHb9VYA/maxresdefault.jpg)](https://www.youtube.com/watch?v=DfR7eHb9VYA)

# 💻 기사 기능 시연 영상

[![무빙 기사님 기능 시연 영상](https://img.youtube.com/vi/SPF-6KNENOQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=SPF-6KNENOQ)

<br/>

# 🚧 시스템 아키텍처

![alt text](/attachment/image.png)

<br/>

# ⚙️ 기술 스택

### ✅ Language

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/NodeJS-5FA04E?style=flat&logo=nodedotjs&logoColor=white)

### ✅ Framework & Libraries

![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=flat&logo=prisma&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white)
![Passport](https://img.shields.io/badge/Passport-34E27A?style=flat&logo=passport&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat&logo=swagger&logoColor=black)

### ✅ Hosting & Deployment

![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=flat&logo=amazonec2&logoColor=white)
![Amazon CloudFront](https://img.shields.io/badge/Amazon_CloudFront-8C4FFF?style=flat&logo=amazoncloudfront&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-2B037A?style=flat&logo=pm2&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

### ✅ Storage & Database

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?style=flat&logo=redis&logoColor=white)
![Amazon S3](https://img.shields.io/badge/Amazon_S3-569A31?style=flat&logo=amazons3&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)

### ✅ CI/CD & Test

![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=githubactions&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat&logo=jest&logoColor=white)

### ✅ Version Control

![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)

<br/>

# 📚 주요 라이브러리

<details>
<summary>서버 / 미들웨어</summary>

- **express**: HTTP 서버 (v5, async 에러 자동 전달)
- **cors**, **cookie-parser**: 크로스 오리진 쿠키 인증
- **express-rate-limit**: 로그인·이메일 인증 요청 속도 제한
- **multer**: 프로필·채팅 이미지 업로드

</details>

<details>
<summary>데이터베이스 / 캐시</summary>

- **prisma**, **@prisma/client**, **@prisma/adapter-pg**, **pg**: ORM 및 PostgreSQL 드라이버
- **ioredis**: Redis 응답 캐시
- **@supabase/supabase-js**: 채팅 메시지 저장·실시간 연동

</details>

<details>
<summary>인증 / 보안</summary>

- **jsonwebtoken**, **express-jwt**: Access·Refresh 토큰 발급 및 검증
- **passport**, **passport-oauth2**: Google·Naver·Kakao 소셜 로그인
- **bcrypt**: 비밀번호 해시

</details>

<details>
<summary>검증 / 문서</summary>

- **zod**: 요청 body·query·params 검증
- **swagger-jsdoc**, **swagger-ui-express**: API 문서 (`/api-docs`)

</details>

<details>
<summary>외부 서비스</summary>

- **@aws-sdk/client-s3**: 이미지 S3 업로드
- **resend**, **@react-email/components**, **@react-email/render**: 이메일 인증 메일 발송
- **@google/genai**: Gemini 기반 리뷰 초안 생성
- **node-cron**: 지난 견적 요청 자동 마감 배치

</details>

<details>
<summary>개발 도구 / 테스트</summary>

- **typescript**, **tsx**: 타입 체크 및 개발 서버(`tsx watch`)
- **eslint**, **prettier**, **husky**, **lint-staged**, **@commitlint/cli**: 코드·커밋 컨벤션
- **jest**, **@swc/jest**, **supertest**: 단위·통합 테스트

</details>

<br/>

# 👥 팀 소개 및 문서

## 팀원 소개

|    이름    |        역할         |                                                              담당                                                               |                       GitHub                       |                                       개인 개발 보고서                                       |
| :--------: | :-----------------: | :-----------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| **한효주** |  👑 팀장 · FE 리드  | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) |     [@damdadaxx](https://github.com/damdadaxx)     | [📄 보고서](https://www.notion.so/damdada/8c37bbb8e51783f68be00149916877ae?source=copy_link) |
| **방민재** | ⭐ 부팀장 · BE 리드 | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) |     [@extermins](https://github.com/extermins)     | [📄 보고서](https://www.notion.so/damdada/24f7bbb8e5178205a41d01fd68ce9e8b?source=copy_link) |
| **김대영** |       🙋 팀원       | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) |  [@daeyeong1573](https://github.com/daeyeong1573)  | [📄 보고서](https://www.notion.so/damdada/b4d7bbb8e51783d3a548815fcb32617f?source=copy_link) |
| **곽서현** |       🙋 팀원       | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) |     [@sgwag6799](https://github.com/sgwag6799)     | [📄 보고서](https://www.notion.so/damdada/6e57bbb8e51782acbc3a81e0e20d280d?source=copy_link) |
| **윤다정** |       🙋 팀원       | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) |    [@torang1013](https://github.com/torang1013)    | [📄 보고서](https://www.notion.so/damdada/cfd7bbb8e51782c89866818b056d9f77?source=copy_link) |
| **전현선** |       🙋 팀원       | ![FE](https://img.shields.io/badge/FE-3178C6?style=flat-square) ![BE](https://img.shields.io/badge/BE-5FA04E?style=flat-square) | [@hyeonseon9909](https://github.com/hyeonseon9909) | [📄 보고서](https://www.notion.so/damdada/9107bbb8e51782d0a5a9819db59db9bd?source=copy_link) |

## 팀 문서

### 📝 [팀 노션](https://www.notion.so/damdada/3377bbb8e51782129977817c0da86c23?v=7f37bbb8e51782efa73e8815e7b07056&source=copy_link)

### 📝 [API 문서](https://app.notion.com/p/damdada/API-3c97bbb8e517809bbbcee27e95dabd72)

### 📝 [Swagger 문서](https://api.moving-team3.xyz/api-docs)

<br>

# 📋 개인별 주요 작업 내역

<details>
<summary>한효주(팀장)</summary>

- **프로젝트 초기 개발 환경 세팅**
  - 팀 컨벤션(AGENTS.md)
- **알림 API**
  - REST + SSE 실시간 알림
  - 견적 이벤트 트리거
- **견적 확정 채팅 API**
  - Supabase 연동

</details>

<details>
<summary>방민재(부팀장)</summary>

- **프로젝트 초기 설정**
  - Prisma 스키마
  - seed 데이터
- **견적 요청(Estimate-Request) API**
  - 견적 요청 생성·진행 중 요청·이력 조회
  - 기사님 받은 요청 조회
- **견적 요청 자동 마감 스케줄러**
  - node-cron 기반 지난 요청 `COMPLETED` / `EXPIRED` 전환
- **Redis 캐시 미들웨어**
  - 기사님 목록·상세 조회 캐싱 및 쓰기 시 무효화
- **백엔드 전체 리팩토링**

</details>

<details>
<summary>김대영</summary>

- **견적(Estimate) API**
  - 지정 견적 / 지정 없이 견적 보내기
  - 견적 확정
- **커서 기반 페이지네이션 공용 유틸**
- **받은 요청 서비스 가능 지역 필터**
  - 주소 검색 API
- **CI/CD 워크플로우**
  - GitHub Actions → EC2 배포, 실패 시 이전 버전 유지
- **테스트 환경**
  - Jest + Supertest

</details>

<details>
<summary>곽서현</summary>

- **Auth API**
  - 회원가입·로그인
  - Refresh 토큰
  - 소셜 로그인(Google·Naver·Kakao)
- **이메일 인증**
  - Resend 발송
  - 만료·IP 제한
- **로그인 보안**
  - 계정당 비밀번호 시도 제한
  - Rate Limit
- **Customer API**
  - 고객 프로필

</details>

<details>
<summary>윤다정</summary>

- **찜(Like) API**
  - 찜 등록·해제·일괄 해제
- **리뷰 API**
  - 리뷰 작성·조회
- **리뷰 AI 초안 작성**
  - Gemini 연동

</details>

<details>
<summary>전현선</summary>

- **기사님(Mover) API**
  - 프로필, 목록·상세 조회
- **프로필 이미지 S3 전환**

</details>

<br/>

# 📁 프로젝트 구조

도메인 단위 모듈 구조로, 각 도메인이 Route · Controller · Service · Repository를 함께 가집니다.

```
src/
├── config/          # 환경변수, Swagger, Zod 전역 설정
├── lib/             # Prisma, Redis, S3, Supabase 클라이언트
├── middlewares/     # 인증, 요청 검증, 캐시, 에러 핸들러
├── types            # 공용 타입
├── modules/
│   ├── auth/        # 회원가입·로그인·소셜 로그인·이메일 인증
|   |    ├── authController.ts
|   |    ├── authRepository.ts
|   |    ├── authSchema.ts
|   |    ├── authRoute.ts
|   |    ├── authService.ts
|   |    └── authValidation.ts
│   ├── customer/          # 고객 프로필
|   ├── docs/              # SWAGGER 문서
│   ├── mover/             # 기사님 프로필·목록·상세
│   ├── estimate-request/  # 견적 요청
│   ├── estimate/          # 견적 발송·확정
│   ├── like/              # 찜
│   ├── review/            # 리뷰·AI 초안
│   ├── notification/      # 알림 (REST + SSE)
│   └── chat/              # 견적 확정 채팅
├── scheduler/       # node-cron 작업
├── scripts/         # 배치 1회 실행 CLI
├── utils/           # 에러 클래스, 커서 페이지네이션, 메일러
├── app.ts
└── server.ts
prisma/
├── schema.prisma    # 메인 DB 스키마
└── schema.chat.prisma
test/
├── unit/
└── integration/
superbase/

```

<br/>

# 🌟 주요 기능 상세

<details>
<summary>1. 인증 시스템</summary>

- **이메일 회원가입·로그인**
  - 고객 / 기사님 역할 구분
  - 비밀번호 특수문자 포함 검증
  - bcrypt 해시
- **이메일 인증**
  - Resend + React Email 인증 메일
  - 만료 시간·발송 IP 제한
- **소셜 로그인**
  - Google · Naver · Kakao (Passport OAuth2, 세션 없이 JWT 발급)
- **토큰**
  - Access·Refresh 토큰을 HttpOnly 쿠키로 발급
  - `/auth/refresh`로 재발급, 만료 시 `TOKEN_EXPIRED`
- **요청 제한**
  - `express-rate-limit` + 계정당 비밀번호 시도 제한으로 무차별 대입 방어

</details>

<details>
<summary>2. 프로필 등록/수정</summary>

- **고객 프로필**
  - 이용 서비스 유형, 지역, 프로필 이미지
- **기사님 프로필**
  - 서비스 유형(다중)
  - 서비스 가능 지역(다중)
  - 경력(개월)·소개
- **이미지 업로드**
  - multer → S3 업로드
  - CloudFront URL로 서빙

</details>

<details>
<summary>3. 견적 요청</summary>

- **견적 요청 생성**
  - 이사 유형·이사일·출발지·도착지
- **진행 중 요청 1건 제한**
  - DB 부분 유니크 인덱스(`status IN ('PENDING','CONFIRMED')`)
- **진행 중 요청 / 이력 조회**
- **자동 마감**
  - 이사일이 지나면 node-cron 배치가 `COMPLETED` / `EXPIRED`로 전환

</details>

<details>
<summary>4. 견적 발송 / 확정</summary>

- **받은 요청 조회(기사님)**
  - 서비스 가능 지역·서비스 유형 필터
  - 커서 기반 무한 스크롤
- **지정 견적 / 일반 견적 발송**
  - 견적 반려
- **받은 견적 조회(고객)**
  - 목록·상세, 기사님 평점·리뷰 수 포함
- **견적 확정**
  - 견적 요청을 `CONFIRMED`로 전환하고 알림을 보내며, 확정된 견적부터 채팅 가능
- **상태 전환 규칙**
  - 역할·현재 상태별 허용 전환을 테이블로 정의해 잘못된 전환은 `409 CONFLICT`

</details>

<details>
<summary>5. 기사님 찾기 / 찜</summary>

- **기사님 목록**
  - 지역·서비스 필터, 평점·리뷰 수·확정 수·찜 수 정렬 (Raw SQL 집계)
- **기사님 상세**
  - 프로필 + 집계 정보, Redis 캐시
- **찜**
  - 등록·해제·일괄 해제, 내 찜 목록

</details>

<details>
<summary>6. 리뷰</summary>

- **리뷰 작성**
  - 이사 완료(`COMPLETED`) 요청의 확정 기사님에게만 작성 가능
- **AI 리뷰 초안**
  - Gemini로 이사 정보 기반 리뷰 초안 생성
- **내 리뷰 / 기사님 리뷰 목록**

</details>

<details>
<summary>7. 실시간 알림</summary>

- **SSE 스트림**(`/notifications/stream`)
  - 새 견적, 견적 확정 등 이벤트 실시간 전송
- **알림 목록 / 안 읽은 개수 / 개별·전체 읽음 처리**

</details>

<details>
<summary>8. 견적 확정 채팅</summary>

- 확정된 견적 단위 1:1 채팅방 (Supabase)
- 메시지 전송·조회, 이미지 전송, 읽음 처리, 안 읽은 개수

</details>

<br/>

# 🚀 성능 최적화 전략

<details>
<summary>1. Redis 응답 캐시</summary>

- **Cache-aside + TTL + 쓰기 시 무효화**
  - `cacheResponse(ttl)` 미들웨어로 GET 응답 캐싱 (`GET /mover` 60초, `GET /mover/:id` 300초)
  - 쿼리를 정렬한 캐시 키(`cache:/mover?region=SEOUL&size=10`)로 같은 조건 재사용
  - 리뷰·찜·견적 확정·프로필 수정 시 `SCAN`으로 `cache:/mover*` 무효화
- **Fail-open**
  - Redis 미설정·장애 시 캐시 없이 DB 조회, 요청이 멈추지 않음 (`enableOfflineQueue: false`)
- **비용 0원 인프라**
  - ElastiCache 대신 기존 EC2에 Docker Redis (`maxmemory 64mb`, `allkeys-lru`)

</details>

<details>
<summary>2. 커서 기반 페이지네이션</summary>

- offset 대신 커서 기반 무한 스크롤로 깊은 페이지에서도 일정한 조회 성능
- 공용 유틸(`cursorPagination.ts`)로 모든 목록 API에 동일 적용

</details>

<details>
<summary>3. 이미지 CDN</summary>

- S3 저장 + CloudFront 엣지 캐싱으로 이미지 응답을 API 서버에서 분리

</details>

<details>
<summary>4. 배포 최적화</summary>

- EC2(1GB)에서 `npm ci`가 10분 넘게 걸리던 문제 → GitHub Actions 러너에서 빌드·`npm prune` 후 압축 전송
- 배포 실패 시 이전 버전 유지

</details>

<br/>

# 💣 트러블 슈팅

<details>
<summary>1. [Redis 캐시] 기사님 목록·상세 조회가 매 요청마다 전체 집계를 돌던 문제</summary>

### ⚠️ 문제 상황

- 비회원도 호출하는 `GET /mover`, `GET /mover/:id`가 요청마다 **전체 기사님의 평점·리뷰 수·확정 수·찜 수를 다시 집계**
- 1페이지 10건만 보여줘도 전체를 집계한 뒤 정렬하고 잘라야 함
- 읽기 ≫ 쓰기인데 결과를 재사용할 계층이 없음

### 🔍 원인 분석

- 집계값이 `MoverProfile` 컬럼이 아니라 `Review`, `Estimate`, `Like`에서 조회 시 계산하는 값
- 정렬 기준이 집계값이라 페이지네이션 전에 전체 집계가 필요

### ✅ 해결 방안

| 후보                      | 판단                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| 집계 컬럼 추가 (비정규화) | 모든 쓰기 경로에서 값을 맞춰야 하고, 하나라도 빠지면 영구히 틀어짐 |
| 프로세스 메모리 캐시      | pm2 재시작마다 유실, 다중 인스턴스에서 무효화 불일치               |
| **Redis 응답 캐시** ✅    | 쿼리·스키마 변경 없음, 재배포에도 유지                             |

- 캐시 미들웨어 + 쓰기 성공 후 `/mover` 캐시 전체 무효화
- **비용**: ElastiCache 대신 기존 EC2에 Docker로 Redis 실행 → 추가 비용 0원
- **메모리**: 1GB 인스턴스·swap 0B 상황 → Redis `maxmemory 64mb` + `allkeys-lru`, swap 1GB 추가
- **보안**: `127.0.0.1:6379`에만 바인딩해 외부 노출 차단

### 📚 배운 점

- 캐시는 원본이 아니므로 장애 시 **fail-open**으로 설계해야 서비스가 멈추지 않는다
- 인프라 도입 전 비용·메모리·디스크까지 실제 서버 상태를 확인해야 한다

👉 [상세 문서](docs/redis-troubleshooting.md)

</details>

<details>
<summary>2. [스케줄러] 이사일이 지난 견적 요청이 영원히 열려 있던 문제</summary>

### ⚠️ 문제 상황

- 이사일이 지난 견적 요청이 `PENDING` / `CONFIRMED`에서 벗어나지 못함
- 고객이 **새 견적 요청 불가**, **리뷰 작성 불가**, 이사 이력 조회가 항상 빈 배열

### 🔍 원인 분석

- 상태 정리 로직 `closePastEstimateRequests()`는 구현돼 있었지만 **호출하는 곳이 없었음**
- 로직 문제가 아니라 "주기적으로 실행해 줄 주체가 없다"는 문제

### ✅ 해결 방안

- 추가 인프라 없이 프로세스 안에서 도는 `node-cron` 도입 (BullMQ·pg_cron 대비)
- **에러 격리**: `runSafely`로 감싸 배치 실패가 API 서버를 죽이지 않게
- **시간대**: `timezone: 'Asia/Seoul'` 명시
- **중복 실행 방지**: `noOverlap: true`
- **설정 오류 조기 발견**: 기동 시 `cron.validate()` 실패면 서버를 띄우지 않음
- **주기**: 하루 1회면 최대 24시간 재요청 불가 → 매시 정각 실행
- 스케줄러와 CLI(`npm run job:close-requests`)가 같은 잡 함수를 공유

### 📚 배운 점

- 구현된 함수가 "어디서 호출되는지"까지 확인해야 기능이 완성된다
- 인프로세스 스케줄러는 에러 격리, 시간대, 중복 실행, 다중 인스턴스를 직접 챙겨야 한다

👉 [상세 문서](docs/scheduler.md)

</details>

<details>
<summary>3. [알림] 롤백된 견적이 SSE로만 보이던 유령 알림 문제</summary>

### ⚠️ 문제 상황

- GNB 알림 뱃지가 올라가고 SSE 알림 카드가 떴는데, 알림을 누르면 **견적 상세가 404**
- 목록을 새로고침하면 해당 알림이 사라짐
- API 응답은 409/500인데 상대방 화면에는 이미 "견적이 도착했어요"가 표시됨
- 같은 기사님이 같은 요청에 견적을 두 번 보내 유니크 제약(P2002)에 걸릴 때 특히 자주 발생

### 🔍 원인 분석

| 경로                                | 언제 보이나                  | 저장 여부        |
| ----------------------------------- | ---------------------------- | ---------------- |
| SSE `notification` / `unread-count` | 서버가 `res.write` 하는 순간 | 메모리(연결)에만 |
| `GET /notifications`                | DB에 row가 있을 때           | PostgreSQL       |

- SSE는 **커밋 여부와 관계없이** 소켓에 바로 씀
- 트랜잭션 안에서 알림을 만들고 바로 푸시 → 이후 롤백되면 DB에는 아무것도 없고 화면에만 알림이 남음
- 커밋 전에 `unread-count`를 세면 롤백 후 뱃지 숫자도 실제 데이터와 어긋남

**시행착오**

- 알림 헬퍼에서 `create` 직후 바로 `publish` → 호출자가 트랜잭션 안인지 알 수 없어 커밋 전에 푸시
- 견적 성공 후 알림을 따로 INSERT → 견적은 있는데 알림이 없는 반대 문제 발생

### ✅ 해결 방안

**저장은 같은 트랜잭션에서, 푸시는 커밋 이후에**

- `create` / `createMany`: 트랜잭션 안에서 **저장만** (SSE 전송 없음)
- `publishCreated`: **커밋된 row만** 푸시, 트랜잭션 밖에서만 호출

```ts
const { estimate, notifications } = await prisma.$transaction(async (tx) => {
  const estimate = await estimateRepository.createGeneral(..., tx);
  const notification = await notificationService.create({ ... }, tx);
  return { estimate, notifications: [notification] };
});

// 커밋이 끝난 뒤에만 푸시
await notificationService.publishCreated(notifications);
```

- P2002로 롤백되면 `publishCreated`가 호출되지 않아 상대방에게 이벤트가 가지 않음
- 지정 견적(`NEW_REQUEST`), 견적 상태 변경(`PROPOSED` / `ACCEPTED`)에도 같은 패턴 적용
- 유닛 테스트로 "성공 시에만 publish, 유니크 위반 시 publish 안 함" 동작을 고정

### 📚 배운 점

- 실시간 전송(SSE)은 트랜잭션 밖의 부수효과라 롤백되지 않는다. 외부로 나가는 이벤트는 커밋 이후로 미뤄야 한다
- 저장과 전달의 책임을 API 단위로 나누면 호출하는 쪽이 순서를 실수하기 어려워진다

**남은 과제**

- `MOVE_DAY` 알림은 `GET /estimate-requests/active` 조회 시점에 생성되므로, 앱을 열지 않으면 발송되지 않음 → 스케줄러 + advisory lock으로 이전 필요
- SSE 연결이 인메모리 `Map`에 저장되어 서버 1대를 전제로 함 → 스케일아웃 시 Redis pub/sub 필요

</details>

<details>
<summary>4. [CI/CD] EC2 배포 타임아웃과 반쯤 교체된 채 남던 배포 문제</summary>

### ⚠️ 문제 상황

**① 첫 배포가 `Run Command Timeout`으로 실패**

- `appleboy/ssh-action`의 제한 시간(10분) 안에 EC2의 `npm ci`가 끝나지 않음
- `npm ci`는 기존 `node_modules`를 먼저 지우므로, 중간에 끊기면서 `express`조차 없는 상태가 남음
- 실행 중인 서버는 메모리에 올라간 모듈로 버티고 있었지만, **재시작되면 뜨지 못하는 상태**

**② 배포 도중 실패하면 새 파일과 옛 파일이 섞여 남음**

- 스크립트가 운영 폴더를 **제자리에서 덮어쓰는 구조**라, 실패한 지점까지의 변경이 그대로 남음
- 응답 확인 단계가 없어서 pm2만 떠 있으면 배포가 성공으로 표시됨

### 🔍 원인 분석

| 요인      | 내용                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| 인스턴스  | t3.micro(메모리 1GB)에서 Node 서버, Nginx, Redis가 함께 동작                     |
| 설치량    | devDependencies(typescript, eslint, tsx 등) 포함 471개 패키지를 EC2에서 설치     |
| 배포 구조 | `rm -rf dist prisma` → 압축 해제 → 설치 → 마이그레이션을 운영 폴더에서 바로 실행 |

### ✅ 해결 방안

**1. 설치는 러너에서, EC2는 실행만**

| 구분             | 변경 전                      | 변경 후                                |
| ---------------- | ---------------------------- | -------------------------------------- |
| 의존성 설치 위치 | EC2 (`npm ci`)               | GitHub Actions 러너                    |
| 설치 대상        | 전체 471개                   | 운영 의존성만 (`npm prune --omit=dev`) |
| EC2에서 하는 일  | 설치 → 마이그레이션 → 재시작 | 압축 해제 → 마이그레이션 → 재시작      |

- `node_modules`째 압축해 전송 (`node_modules` 372MB → 압축 약 101MB)
- 운영 번들에서 `migrate deploy`를 돌리기 위해 `prisma` CLI를 dependencies로 이동
- `npx` 대신 `./node_modules/.bin/prisma`를 직접 실행 (설치 여부를 묻느라 멈추는 것 방지)

**2. 별도 폴더에서 준비 → 교체 → 응답 확인 → 실패 시 복구**

| 단계 | 하는 일                                    | 여기서 실패하면                  |
| ---- | ------------------------------------------ | -------------------------------- |
| 1/5  | 새 버전을 `STAGE` 폴더에 압축 해제         | 운영 폴더 그대로                 |
| 2/5  | `STAGE`에서 `prisma migrate deploy`        | 운영 폴더 그대로                 |
| 3/5  | 운영 파일을 `PREV`로 옮기고 새 파일로 교체 | (복구 대상)                      |
| 4/5  | pm2로 재시작                               | (복구 대상)                      |
| 5/5  | `/api-docs/` 응답을 최대 30초 확인         | `PREV`로 되돌려 이전 버전 재시작 |

```bash
for item in $ITEMS; do
  [ -e "$APP/$item" ] && mv "$APP/$item" "$PREV/$item"   # 이전 파일은 PREV 로
  mv "$STAGE/$item" "$APP/$item"                          # 새 파일을 운영 위치로
done
```

- `set -eo pipefail`로 어느 명령이든 실패하면 즉시 중단
- 교체 목록(`ITEMS`)에 있는 파일만 옮겨서 `uploads/` 같은 파일은 보존
- 복구에 성공해도 `exit 1`로 끝내 **배포 실패 사실을 Actions에 남김**
- 가짜 `pm2`·`curl`·`prisma`를 쓴 샌드박스에서 정상 / 마이그레이션 실패 / 응답 없음 시나리오를 검증

### 📚 배운 점

- 메모리가 작은 서버에서는 설치처럼 무거운 작업을 서버 밖(러너)에서 끝내고, 서버는 실행만 맡긴다
- 배포는 "준비 → 교체 → 확인 → 복구" 단계로 나눠야 실패해도 운영 상태가 깨지지 않는다

**한계**

- DB 마이그레이션은 되돌리지 않음 → 이전 코드와 호환되게(컬럼 추가 위주) 작성하기로 함
- 롤백은 샌드박스에서만 검증했고, 실서버에서 일으켜 본 적은 없음
- pm2 재시작 중 수 초간 응답이 끊길 수 있음

</details>

<br/>

# ▶️ 실행 방법

```bash
npm install
cp .env.example .env.development   # 값 채우기
npm run db:migrate
npm run dev
```

API 문서: `http://localhost:{PORT}/api-docs`

```bash
npm test                 # 전체 테스트
npm run test:unit
npm run test:integration
```
