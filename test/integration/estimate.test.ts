import { prisma } from '../../src/lib/prisma';
import {
  createCustomer,
  createEstimateRequest,
  createMover,
  loginAs,
} from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const setup = async () => {
  const customer = await createCustomer();
  const mover = await createMover();
  const estimateRequest = await createEstimateRequest(customer.id);
  return { customer, mover, estimateRequest };
};

describe('/estimates', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('POST /: 기사님이 견적을 보내면 201 이고 고객에게 새 견적 알림이 생긴다', async () => {
    const { customer, mover, estimateRequest } = await setup();
    const agent = await loginAs(mover);

    const response = await agent
      .post('/estimates')
      .send({
        estimateRequestId: estimateRequest.id,
        price: 250000,
        comment: '꼼꼼하게 옮겨 드리겠습니다.',
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      status: 'PROPOSED',
      isDesignated: false,
      price: 250000, // DB 는 BigInt 지만 JSON 은 number
    });
    const notifications = await prisma.notification.findMany({
      where: { userId: customer.id, type: 'NEW_ESTIMATE' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].targetPath).toBe(response.body.data.estimateId);
  });

  test('POST /: 같은 요청에 두 번 보내면 409, 고객 계정이면 403', async () => {
    const { customer, mover, estimateRequest } = await setup();
    const body = {
      estimateRequestId: estimateRequest.id,
      price: 250000,
      comment: '꼼꼼하게 옮겨 드리겠습니다.',
    };
    const moverAgent = await loginAs(mover);
    await moverAgent.post('/estimates').send(body).expect(201);
    await moverAgent.post('/estimates').send(body).expect(409);

    const customerAgent = await loginAs(customer);
    await customerAgent.post('/estimates').send(body).expect(403);
  });

  test('PATCH /:id: 고객이 확정하면 견적은 ACCEPTED, 요청은 CONFIRMED, 나머지 견적은 NOT_SELECTED', async () => {
    const { customer, mover, estimateRequest } = await setup();
    const otherMover = await createMover();
    const [picked, other] = await Promise.all(
      [mover, otherMover].map((m) =>
        prisma.estimate.create({
          data: {
            estimateRequestId: estimateRequest.id,
            moverId: m.id,
            price: 200000,
            status: 'PROPOSED',
          },
        })
      )
    );
    const agent = await loginAs(customer);

    await agent
      .patch(`/estimates/${picked.id}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    const [pickedAfter, otherAfter, requestAfter] = await Promise.all([
      prisma.estimate.findUnique({ where: { id: picked.id } }),
      prisma.estimate.findUnique({ where: { id: other.id } }),
      prisma.estimateRequest.findUnique({ where: { id: estimateRequest.id } }),
    ]);
    expect(pickedAfter?.status).toBe('ACCEPTED');
    expect(otherAfter?.status).toBe('NOT_SELECTED');
    expect(requestAfter?.status).toBe('CONFIRMED');
  });

  test('PATCH /:id: 기사님이 지정 견적을 반려하면 고객에게만 ESTIMATE_REJECTED 알림이 생긴다', async () => {
    const { customer, mover, estimateRequest } = await setup();
    const estimate = await prisma.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        moverId: mover.id,
        isDesignated: true,
        status: 'DESIGNATED',
      },
    });
    const agent = await loginAs(mover);

    await agent
      .patch(`/estimates/${estimate.id}`)
      .send({
        status: 'REJECTED',
        rejectReason: '해당 날짜에 이미 확정된 이사 일정이 있어 어렵습니다.',
      })
      .expect(200);

    const customerNotifications = await prisma.notification.findMany({
      where: { userId: customer.id, type: 'ESTIMATE_REJECTED' },
    });
    expect(customerNotifications).toHaveLength(1);
    expect(customerNotifications[0].targetPath).toBeNull();
    expect(customerNotifications[0].content).toContain('테스트기사');

    const moverNotifications = await prisma.notification.findMany({
      where: { userId: mover.id, type: 'ESTIMATE_REJECTED' },
    });
    expect(moverNotifications).toHaveLength(0);
  });

  test('GET /:id: 본인 견적만 조회할 수 있다', async () => {
    const { customer, mover, estimateRequest } = await setup();
    const estimate = await prisma.estimate.create({
      data: {
        estimateRequestId: estimateRequest.id,
        moverId: mover.id,
        price: 200000,
        status: 'PROPOSED',
      },
    });

    const owner = await loginAs(customer);
    const response = await owner.get(`/estimates/${estimate.id}`).expect(200);
    expect(response.body.data.canConfirm).toBe(true);

    const stranger = await loginAs(await createCustomer());
    await stranger.get(`/estimates/${estimate.id}`).expect(403);
  });
});
