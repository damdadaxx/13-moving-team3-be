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

## 코드 컨벤션

- **ESLint** + **Prettier** 적용
- **Husky**로 커밋 전 자동 lint/format 실행
- **commitlint** 커밋 메시지 규칙: `feat` | `fix` | `style` | `test` | `docs` | `chore` | `refactor`

```bash
# 예시
git commit -m "feat: 견적 요청 API 구현"
```
