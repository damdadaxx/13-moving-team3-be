import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { createCustomer, createMover, loginAs } from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const PROFILE = { region: 'SEOUL', serviceTypes: ['SMALL_MOVE', 'HOME_MOVE'] };

describe('/customer/profile', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('POST: 프로필을 등록하면 201 이고 DB 에 저장된다', async () => {
    const customer = await createCustomer({ withProfile: false });
    const agent = await loginAs(customer);

    const response = await agent
      .post('/customer/profile')
      .send(PROFILE)
      .expect(201);

    expect(response.body.data).toMatchObject({
      userId: customer.id,
      region: 'SEOUL',
      serviceTypes: expect.arrayContaining(['SMALL_MOVE', 'HOME_MOVE']),
    });
    const saved = await prisma.customerProfile.findUnique({
      where: { userId: customer.id },
    });
    expect(saved?.region).toBe('SEOUL');
  });

  test('POST: 이미 프로필이 있으면 409', async () => {
    const agent = await loginAs(await createCustomer());

    await agent.post('/customer/profile').send(PROFILE).expect(409);
  });

  test('POST: 잘못된 지역이면 400 VALIDATION_ERROR', async () => {
    const agent = await loginAs(await createCustomer({ withProfile: false }));

    const response = await agent
      .post('/customer/profile')
      .send({ ...PROFILE, region: 'MARS' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET: 본인 프로필을 조회한다 / 프로필이 없으면 404', async () => {
    const withProfile = await loginAs(await createCustomer());
    await withProfile.get('/customer/profile').expect(200);

    const withoutProfile = await loginAs(
      await createCustomer({ withProfile: false })
    );
    await withoutProfile.get('/customer/profile').expect(404);
  });

  test('PATCH: 지역을 수정한다', async () => {
    const agent = await loginAs(await createCustomer());

    const response = await agent
      .patch('/customer/profile')
      .send({ region: 'BUSAN', serviceTypes: ['OFFICE_MOVE'] })
      .expect(200);

    expect(response.body.data).toMatchObject({
      region: 'BUSAN',
      serviceTypes: ['OFFICE_MOVE'],
    });
  });

  test('기사님 계정은 403, 비로그인은 401', async () => {
    const mover = await loginAs(await createMover());
    await mover.get('/customer/profile').expect(403);

    await request(app).get('/customer/profile').expect(401);
  });
});
