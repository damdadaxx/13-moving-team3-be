import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { createCustomer, createMover, loginAs } from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const PROFILE = {
  nickname: '새기사',
  careerMonths: 36,
  shortIntro: '정직하게 견적 드립니다',
  description: '포장부터 정리까지 책임지고 이사해 드립니다.',
  serviceTypes: ['SMALL_MOVE'],
  serviceRegions: ['SEOUL', 'GYEONGGI'],
};

describe('/mover', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('POST /profile: 기사님 프로필을 등록하면 201', async () => {
    const mover = await createMover({ withProfile: false });
    const agent = await loginAs(mover);

    await agent.post('/mover/profile').send(PROFILE).expect(201);

    const saved = await prisma.moverProfile.findUnique({
      where: { userId: mover.id },
      include: { serviceRegions: true },
    });
    expect(saved?.nickname).toBe('새기사');
    expect(saved?.serviceRegions.map(({ region }) => region).sort()).toEqual([
      'GYEONGGI',
      'SEOUL',
    ]);
  });

  test('POST /profile: 이미 프로필이 있으면 409, 고객 계정이면 403', async () => {
    const mover = await loginAs(await createMover());
    await mover.post('/mover/profile').send(PROFILE).expect(409);

    const customer = await loginAs(await createCustomer());
    await customer.post('/mover/profile').send(PROFILE).expect(403);
  });

  test('POST /profile: 한 줄 소개가 8자 미만이면 400', async () => {
    const agent = await loginAs(await createMover({ withProfile: false }));

    await agent
      .post('/mover/profile')
      .send({ ...PROFILE, shortIntro: '짧음' })
      .expect(400);
  });

  test('PATCH /profile: 별명을 수정한다', async () => {
    const mover = await createMover();
    const agent = await loginAs(mover);

    await agent
      .patch('/mover/profile')
      .send({ nickname: '바뀐별명' })
      .expect(200);

    const saved = await prisma.moverProfile.findUnique({
      where: { userId: mover.id },
    });
    expect(saved?.nickname).toBe('바뀐별명');
  });

  test('GET /: 비로그인으로 기사님 목록을 조회한다', async () => {
    await createMover({ nickname: '목록기사' });

    const response = await request(app).get('/mover').expect(200);

    expect(JSON.stringify(response.body.data)).toContain('목록기사');
  });

  test('GET /:id: 기사님 상세 / 없는 id 는 404', async () => {
    const mover = await createMover({ nickname: '상세기사' });

    const response = await request(app).get(`/mover/${mover.id}`).expect(200);
    expect(JSON.stringify(response.body.data)).toContain('상세기사');

    await request(app).get(`/mover/${randomUUID()}`).expect(404);
  });
});
