import type { Express } from 'express';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';

describe('app', () => {
  afterAll(() => prisma.$disconnect());

  test('GET /health: 인증 없이 200 을 준다', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  test('GET /api-docs: 개발·테스트 환경에서는 문서가 열린다', async () => {
    await request(app).get('/api-docs/').expect(200);
  });

  test('GET /api-docs: 운영(production)에서는 라우트가 없어 404 이고 /health 는 그대로 200 이다', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let productionApp: Express | undefined;
    try {
      jest.isolateModules(() => {
        // NODE_ENV 를 바꾼 채로 app 을 새로 읽어야 해서 동기 require 가 필요하다
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        productionApp = require('../../src/app').default;
      });
    } finally {
      process.env.NODE_ENV = previous;
    }

    await request(productionApp).get('/api-docs/').expect(404);
    await request(productionApp).get('/health').expect(200);
  });
});
