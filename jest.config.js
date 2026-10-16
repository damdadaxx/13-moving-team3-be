/*=================================================
Jest 설정
=================================================*/
/*
@ 가이드
- unit        : test/unit/**        — Service, middleware 등 함수 단위. DB 없이 jest.mock 으로 의존성을 대체한다
- integration : test/integration/** — Supertest 로 API 를 호출해 Route → Controller → Service → Repository → 테스트 DB 까지 검증한다
- TS 변환은 @swc/jest (타입 검사 없이 변환만). ts-jest 는 TypeScript 6 을 지원하지 않는다
@ 주의사항
- integration 은 globalSetup 에서 테스트 DB 안전장치를 통과해야 실행된다 (test/assertTestDatabase.ts)
- integration 은 같은 DB 를 비우고 채우므로 --runInBand 로 순서대로 실행한다 (package.json scripts)
*/
const transform = {
  '^.+\\.(t|j)sx?$': [
    '@swc/jest',
    {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
    },
  ],
};

module.exports = {
  // 커버리지는 `npm run test:coverage` 로 측정한다. 결과는 coverage/ (git 제외)
  // swc 로 변환한 코드라 istanbul 대신 v8 로 측정한다
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/generated/**', // Prisma 생성물
    '!src/docs/**', // Swagger 주석뿐인 파일
    '!src/scripts/**',
    '!src/types/**',
    '!src/server.ts', // listen 만 하는 진입점
    '!src/**/*.d.ts',
  ],
  coverageReporters: ['text-summary', 'text', 'html', 'lcov'],
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
      transform,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
      globalSetup: '<rootDir>/test/globalSetup.ts',
      transform,
    },
  ],
};
