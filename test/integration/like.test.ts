import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { createCustomer, createMover, loginAs } from '../fixtures';
import { resetDatabase } from '../resetDatabase';

describe('/likes', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('찜하기 → 찜 수 조회 → 찜 취소', async () => {
    const mover = await createMover();
    const agent = await loginAs(await createCustomer());

    const created = await agent
      .post('/likes')
      .send({ moverId: mover.id })
      .expect(201);
    expect(created.body.data.likeCount).toBe(1);

    const count = await request(app).get(`/likes/${mover.id}`).expect(200);
    expect(count.body.data.likeCount).toBe(1);

    const info = await agent.get(`/likes/me/${mover.id}`).expect(200);
    expect(info.body.data.isLiked).toBe(true);

    await agent.delete(`/likes/${mover.id}`).expect(200);
    expect(await prisma.like.count({ where: { moverId: mover.id } })).toBe(0);
  });

  test('이미 찜했으면 400, 찜하지 않은 기사님 취소도 400', async () => {
    const mover = await createMover();
    const agent = await loginAs(await createCustomer());

    await agent.post('/likes').send({ moverId: mover.id }).expect(201);
    await agent.post('/likes').send({ moverId: mover.id }).expect(400);

    await agent.delete(`/likes/${mover.id}`).expect(200);
    await agent.delete(`/likes/${mover.id}`).expect(400);
  });

  test('기사님 계정은 찜할 수 없다 (403)', async () => {
    const target = await createMover();
    const agent = await loginAs(await createMover());

    await agent.post('/likes').send({ moverId: target.id }).expect(403);
  });

  test('POST /bulk-delete: 여러 기사님 찜을 한 번에 취소한다', async () => {
    const movers = await Promise.all([createMover(), createMover()]);
    const agent = await loginAs(await createCustomer());
    for (const mover of movers) {
      await agent.post('/likes').send({ moverId: mover.id }).expect(201);
    }

    await agent
      .post('/likes/bulk-delete')
      .send({ moverIds: movers.map(({ id }) => id) })
      .expect(200);

    expect(await prisma.like.count()).toBe(0);
  });
});
