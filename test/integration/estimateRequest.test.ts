import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import {
  createCustomer,
  createEstimateRequest,
  createMover,
  daysFromNow,
  loginAs,
} from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const BODY = () => ({
  serviceType: 'HOME_MOVE',
  moveDate: daysFromNow(10).toISOString(),
  departureZipCode: '04524',
  departureAddress: '서울특별시 중구 세종대로 110',
  arrivalZipCode: '06035',
  arrivalAddress: '서울특별시 강남구 가로수길 5',
});

describe('/estimate-requests', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('POST /: 견적 요청을 만들면 201 이고 진행 중 요청으로 연결된다', async () => {
    const customer = await createCustomer();
    const agent = await loginAs(customer);

    const created = await agent
      .post('/estimate-requests')
      .send(BODY())
      .expect(201);
    expect(created.body.data.status).toBe('PENDING');

    const active = await agent.get('/estimate-requests/active').expect(200);
    expect(active.body.data.id).toBe(created.body.data.id);
  });

  test('POST /: 진행 중인 요청이 있으면 409, 이사일이 지났으면 400', async () => {
    const agent = await loginAs(await createCustomer());
    await agent.post('/estimate-requests').send(BODY()).expect(201);

    await agent.post('/estimate-requests').send(BODY()).expect(409);
    await agent
      .post('/estimate-requests')
      .send({ ...BODY(), moveDate: daysFromNow(-1).toISOString() })
      .expect(400);
  });

  test('POST /: 기사님 계정은 403, 비로그인은 401', async () => {
    const mover = await loginAs(await createMover());
    await mover.post('/estimate-requests').send(BODY()).expect(403);

    await request(app).post('/estimate-requests').send(BODY()).expect(401);
  });

  test('POST /:id/estimates: 지정 견적은 3명까지, 같은 기사님은 한 번만', async () => {
    const customer = await createCustomer();
    const agent = await loginAs(customer);
    const { body } = await agent
      .post('/estimate-requests')
      .send(BODY())
      .expect(201);
    const requestId = body.data.id;
    const movers = await Promise.all([1, 2, 3, 4].map(() => createMover()));
    const designate = (moverId: string) =>
      agent.post(`/estimate-requests/${requestId}/estimates`).send({ moverId });

    for (const mover of movers.slice(0, 3)) {
      await designate(mover.id).expect(201);
    }
    await designate(movers[0].id).expect(409);
    await designate(movers[3].id).expect(409);

    // 지정받은 기사님에게 새 요청 알림이 간다
    const notified = await prisma.notification.count({
      where: { userId: movers[0].id, type: 'NEW_REQUEST' },
    });
    expect(notified).toBe(1);
  });

  test('GET /received: 서비스 가능 지역 체크 시 고객 지역이 맞는 요청만 보인다', async () => {
    const seoulCustomer = await createCustomer({ region: 'SEOUL' });
    const busanCustomer = await createCustomer({ region: 'BUSAN' });
    const seoulRequest = await createEstimateRequest(seoulCustomer.id);
    const busanRequest = await createEstimateRequest(busanCustomer.id);
    const mover = await loginAs(await createMover({ regions: ['SEOUL'] }));

    const all = await mover.get('/estimate-requests/received').expect(200);
    const ids = all.body.data.list.map(
      (item: { estimateRequestId: string }) => item.estimateRequestId
    );
    expect(ids).toEqual(
      expect.arrayContaining([seoulRequest.id, busanRequest.id])
    );

    const inArea = await mover
      .get('/estimate-requests/received?isServiceArea=true')
      .expect(200);
    expect(
      inArea.body.data.list.map(
        (item: { estimateRequestId: string }) => item.estimateRequestId
      )
    ).toEqual([seoulRequest.id]);
  });
});
