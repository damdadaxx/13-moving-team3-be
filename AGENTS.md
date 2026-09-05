# 13-moving-team3-be

이사 소비자와 이사 전문가 매칭 서비스의 **백엔드 API** 서버다.
에이전트는 이 파일과 `.cursor/rules/`를 따른다. 컨벤션 원본은 `eslint.config.mjs`, `.prettierrc`, `commitlint.config.js`, `.github/` 템플릿이다.

## 역할

- 코드 작성·수정·디버깅은 직접 한다.
- **커밋, PR, 이슈는 직접 만든다.** 요청받으면 메시지/본문만 작성하고 실행하지 않는다.
- 비밀값(`.env*`, 토큰, 비밀번호)을 커밋하거나 출력하지 않는다.

## 스택

Express 5 + TypeScript + Prisma 7 + PostgreSQL.
인증은 JWT(`express-jwt`, `jsonwebtoken`)와 Passport(Naver/Kakao/Google).
검증은 Zod, 문서는 Swagger, 개발 실행은 `tsx watch`.

필수 환경변수: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
추가 시 `.env` / `.env.development` / `.env.production`과 `.env.example`을 함께 맞춘다.

## 명령

```bash
npm run dev              # 개발 서버 (NODE_ENV=development)
npm run build            # tsc → dist/
npm run lint             # ESLint
npm run lint:fix
npm run format           # Prettier
npm run db:migrate       # prisma migrate dev (.env.development)
npm run db:studio
```

스키마를 바꾸면 `prisma migrate`로 migration 파일을 만들고 커밋에 포함한다. `db push`는 로컬 실험용이다.

## 폴더

도메인 단위 모듈이다. 레이어별 플랫 폴더(`routes/`, `controllers/`)를 만들지 않는다.

```
src/
├── config/          # env.ts, swagger.ts
├── lib/             # prisma.ts (PrismaClient 싱글톤)
├── middlewares/     # errorHandler.ts, validation.ts
├── modules/{domain}/
│   ├── {domain}Route.ts
│   ├── {domain}Controller.ts   # 라우터의 각 API 요청을 핸들링하고 req, res를 처리. 서비스 레이어 호출 및 에러 처리를 담당.
│   └── {domain}Service.ts      # 해당 도메인의 비즈니스 로직을 구현. DB 작업 및 외부 서비스 연계를 담당. 컨트롤러에서 파라미터를 받아 실제 로직을 처리.
├── types/           # express.d.ts
├── utils/           # error.ts
├── app.ts           # 미들웨어·라우터. 라우터는 반드시 errorHandler 위
└── server.ts        # listen
prisma/schema.prisma
```

도메인: `auth`, `customer`, `mover`, `estimate`, `like`, `review`, `notification`.
Prisma Client는 `src/generated/prisma`에 생성되며 git에 올리지 않는다. import는 `src/lib/prisma.ts`의 `prisma`만 쓴다.

## 네이밍

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 변수·함수 | camelCase | `userId`, `findByEmail`, `isActive` |
| 클래스·타입·인터페이스 | PascalCase | `AppError`, `CreateMoverDto` |
| 상수 | SNAKE_CASE | `JWT_ACCESS_SECRET` |
| 파일 | camelCase + 역할 접미사 | `authRoute.ts`, `errorHandler.ts` |
| 폴더 | 소문자 | `modules/auth/` |
| Boolean | `is` / `has` / `can` / `should` | `isActive` |

미사용 인자는 `_` 접두사 (`_next`). 약어는 피한다.

레이어 간 호출은 네임스페이스 import, 유틸은 named import.

```ts
import * as authService from './authService';
import { NotFoundError } from '../../utils/error';

authService.signUp(data);
```

컨트롤러는 req/res만, 비즈니스 로직은 서비스, DB는 `prisma`로 한다.
서비스에서 `throw new NotFoundError()`처럼 던지고, 컨트롤러는 `next(error)`로 넘긴다.

## TypeScript

`tsconfig.json`은 `strict: true`다. 타입 에러를 무시하거나 `// @ts-ignore`를 쓰지 않는다.

| 대상 | 규칙 |
| --- | --- |
| 객체 확장(Express 등) | `interface` |
| 유니온·별칭 | `type` |
| 요청 DTO | Zod 스키마 + `z.infer<typeof schema>` |
| DB 모델 | Prisma Client 타입. 직접 미러링하지 않는다 |
| `any` | 금지에 가깝다. 불가피하면 `unknown` 후 좁힌다 |
| `catch` | `error: unknown` → `instanceof`로 좁힌다 |

```ts
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type CreateUserInput = z.infer<typeof createUserSchema>;

export const signUp = async (data: CreateUserInput) => {
  // ...
};
```

```ts
} catch (error: unknown) {
  if (error instanceof AppError) return next(error);
  next(error);
}
```

- Express 타입은 `@types/express`와 `src/types/express.d.ts`로 확장한다. `validatedData`를 `any`로 두지 말고, 쓰는 쪽에서 `z.infer`로 단언하거나 제네릭을 유지한다.
- Prisma 생성 타입(`src/generated/`)을 수정하지 않는다.
- 테스트·스펙·`src/generated`는 `tsc` 컴파일에서 제외되어 있다. 앱 코드는 `src/`만 넣고 `rootDir`를 깨지 않는다.

## 요청·응답

요청 검증은 `validate(schema, 'body' | 'query' | 'params')`.
성공 시 값은 `req.validatedData`에 들어간다 (`src/types/express.d.ts`).

에러는 `src/utils/error.ts`의 `AppError` 하위 클래스만 쓴다.

| 클래스 | status |
| --- | --- | --- |
| `BadRequestError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

`errorHandler` 응답 형식(이미 구현됨):

```json
{ "path": "/...", "method": "POST", "message": "...", "date": "..." }
```

Zod 실패는 `errors: [{ field, message }]`.
성공 응답은 JSON으로 맞추되, 아직 공통 `success` 래퍼는 없다. 새로 만들지 말고 기존 핸들러 형식을 따른다.

라우터는 `app.ts`에서 `errorHandler` **위에** 등록한다.

## 코딩 스타일

Prettier (`.prettierrc`): `semi`, `singleQuote`, `tabWidth: 2`, `printWidth: 80`, `trailingComma: es5`, `arrowParens: always`, `endOfLine: lf`.

ESLint (`eslint.config.mjs`):

- `var` 금지, 재할당 없으면 `const`
- `console`은 warn. 디버그 `console.log`는 남기지 않는다
- 미사용 변수 금지 (`_` 예외)
- `any`는 warn. 가능하면 구체 타입

공유가 필요한 코드만 주석을 단다.

```ts
/*=================================================
주석 제목
=================================================*/
/*
@ 가이드
- 설명
@ 주의사항
- 조건
*/
```

## Git / PR / 이슈

브랜치: `main`(프로덕션) ← `dev`(개발) ← `feat/{이슈번호}-{기능명}` 또는 `fix/{이슈번호}-{기능명}`.
예: `feat/1-auth-login`.

- `feat/*` → `dev`: Squash and Merge
- `dev` → `main`: Merge Commit
- 작업 전 `origin/dev` rebase. 이미 올린 PR을 rebase한 뒤에는 `--force-with-lease` (에이전트는 강제 푸시하지 않는다)

커밋 메시지 (`commitlint.config.js`):

```
feat|fix|style|test|docs|chore|refactor: 설명
```

예: `feat: 사용자 로그인 API 추가`

PR 제목: `[FEAT] 로그인 API 구현` / `[FIX] 리프레시 토큰 만료 오류 수정`
본문은 `.github/PULL_REQUEST_TEMPLATE.md`를 따른다. 관련 이슈는 `resolve #번호`.

이슈 제목 접두사와 라벨:

| 접두사 | 라벨 | 용도 |
| --- | --- | --- |
| `[BE][FEAT]` | feature | 새 API/기능 |
| `[BE][BUG]` | bug | 오동작 |
| `[BE][DISCUSS]` / `[DISCUSS]` | discussion | 구현 전 결정 |
| `[REFACTOR]` | refactor | 동작 유지, 구조만 변경 |
| `[CHORE]` | chore | 설정·문서·의존성 |

양식은 `.github/ISSUE_TEMPLATE/`을 따른다. 작업 시작 전 이슈를 먼저 둔다.

## Prisma

- 스키마: `prisma/schema.prisma`. 삭제는 hard-delete, `@updatedAt`으로 수정 여부 판단.
- 설정: `prisma7.config.ts`. Prisma 7은 `@prisma/adapter-pg`가 필요하다.
- 생성물(`src/generated/`)을 직접 수정하지 않는다.

## 하지 말 것

- `src/generated/`, `node_modules/`, `dist/`, `prisma/migrations/*.sql` 수동 편집
- 라우터를 `errorHandler` 아래에 등록
- 레이어를 건너뛰어 라우터에서 Prisma를 직접 호출 (컨트롤러/서비스가 생기면)
- 커밋·PR·이슈·push를 에이전트가 실행
- 하드코딩된 시크릿
