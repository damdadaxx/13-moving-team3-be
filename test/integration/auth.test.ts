import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/utils/hash';
import { resetDatabase } from '../resetDatabase';

const MOVER = {
  email: 'mover@test.kr',
  password: 'test1234!',
  role: 'MOVER',
} as const;

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.user.create({
      data: {
        name: '테스트기사',
        email: MOVER.email,
        password: await hashPassword(MOVER.password),
        role: MOVER.role,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('올바른 계정이면 200 과 함께 인증 쿠키를 내려준다', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send(MOVER)
      .expect(200)
      .expect('Content-Type', /json/);

    const cookies = response.get('Set-Cookie') ?? [];
    expect(cookies.some((cookie) => cookie.startsWith('accessToken='))).toBe(
      true
    );
    expect(cookies.some((cookie) => cookie.startsWith('refreshToken='))).toBe(
      true
    );
    expect(response.body.success).toBe(true);
  });

  test('비밀번호가 틀리면 401', async () => {
    await request(app)
      .post('/auth/login')
      .send({ ...MOVER, password: 'wrong-password' })
      .expect(401);
  });

  test('로그인 쿠키로 GET /auth/me 에 접근할 수 있다', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send(MOVER).expect(200);

    const response = await agent.get('/auth/me').expect(200);
    expect(response.body.data.email).toBe(MOVER.email);
  });

  test('쿠키 없이 GET /auth/me 는 401', async () => {
    await request(app).get('/auth/me').expect(401);
  });
});
