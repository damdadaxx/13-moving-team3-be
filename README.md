# 13-moving-team3-be

3팀 고급 프로젝트 - 무빙 : 이사 소비자와 이사 전문가 매칭 서비스 플랫폼 백엔드 API 서버입니다.

## 기술 스택

- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Language**: TypeScript

## 개발 환경 세팅

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

## 인증

- **쿠키**: `accessToken`(`Path=/`, 15분) / `refreshToken`(`Path=/auth`, 7일). 둘 다 `HttpOnly`, 운영 `Secure; SameSite=None`.
- 모든 `401` → `POST /auth/refresh` 1회 시도 후 재시도, 실패 시 로그인. `/auth/refresh` 는 프론트에서 single-flight 로 호출.
- **소셜 로그인 (프론트 릴레이)**: 프론트가 프로바이더 authorize → `redirect_uri`(프론트 소유)로 code 수신 → `POST /auth/social/:provider` body `{ code, redirectUri, state?(네이버 필수), role }` 로 전달. 백엔드가 code→token→프로필 교환 후 쿠키 발급.
- 로그인/회원가입/비번변경/소셜에 rate limit(`429`). 저장소가 인메모리라 다중 인스턴스 배포 시 공유 store 필요.

## 코드 컨벤션

- **ESLint** + **Prettier** 적용
- **Husky**로 커밋 전 자동 lint/format 실행
- **commitlint** 커밋 메시지 규칙: `feat` | `fix` | `style` | `test` | `docs` | `chore` | `refactor`

```bash
# 예시
git commit -m "feat: 견적 요청 API 구현"
git commit -m "refactor: 견적 요청 API 리팩토링"
```
