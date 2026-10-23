import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { tossClient } from '../../src/modules/payment/tossClient';
import {
  createCustomer,
  createEstimateRequest,
  createMover,
  loginAs,
} from '../fixtures';
import { resetDatabase } from '../resetDatabase';

// 토스 API 는 실제로 부르지 않는다
jest.mock('../../src/modules/payment/tossClient', () => ({
  ...jest.requireActual('../../src/modules/payment/tossClient'),
  tossClient: { confirm: jest.fn(), getPayment: jest.fn() },
}));

const toss = jest.mocked(tossClient);

const PRICE = 1_000_000n;

// 견적이 확정된(ACCEPTED) 상태에서 시작한다
const setup = async () => {
  const customer = await createCustomer();
  const mover = await createMover();
  const estimateRequest = await createEstimateRequest(customer.id, {
    status: 'CONFIRMED',
  });
  const estimate = await prisma.estimate.create({
    data: {
      estimateRequestId: estimateRequest.id,
      moverId: mover.id,
      price: PRICE,
      status: 'ACCEPTED',
    },
  });
  return { customer, mover, estimateRequest, estimate };
};

describe('/payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    return resetDatabase();
  });
  afterAll(() => prisma.$disconnect());

  test('선수금 → 이사 완료 → 잔금까지 결제하면 정산이 완료된다', async () => {
    const { customer, estimateRequest, estimate } = await setup();
    const agent = await loginAs(customer);
    const confirmWith = (orderId: string, amount: number, key: string) => {
      toss.confirm.mockResolvedValueOnce({
        paymentKey: key,
        orderId,
        status: 'DONE',
        totalAmount: amount,
        approvedAt: '2026-10-20T01:00:00+09:00',
      });
      return agent
        .post('/payments/confirm')
        .send({ paymentKey: key, orderId, amount });
    };

    const before = await agent
      .get(`/estimates/${estimate.id}/payments`)
      .expect(200);
    expect(before.body.data).toMatchObject({
      price: 1_000_000,
      depositAmount: 100_000,
      balanceAmount: 900_000,
      canPayDeposit: true,
      canPayBalance: false,
      isSettled: false,
    });

    // 선수금 주문: 같은 주문을 다시 요청하면 같은 orderId
    const order = await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(200);
    expect(order.body.data).toMatchObject({
      amount: 100_000,
      customerKey: customer.id,
    });
    const again = await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(200);
    expect(again.body.data.orderId).toBe(order.body.data.orderId);

    // 금액이 다르면 토스를 부르기 전에 거절한다
    await agent
      .post('/payments/confirm')
      .send({ paymentKey: 'k', orderId: order.body.data.orderId, amount: 1 })
      .expect(400);
    expect(toss.confirm).not.toHaveBeenCalled();

    const paid = await confirmWith(order.body.data.orderId, 100_000, 'key-1');
    expect(paid.status).toBe(200);
    expect(paid.body.data).toMatchObject({ type: 'DEPOSIT', status: 'PAID' });

    // 같은 승인 요청이 반복돼도 성공하고 토스는 다시 부르지 않는다
    await agent
      .post('/payments/confirm')
      .send({
        paymentKey: 'key-1',
        orderId: order.body.data.orderId,
        amount: 100_000,
      })
      .expect(200);
    expect(toss.confirm).toHaveBeenCalledTimes(1);

    // 이사 완료 전에는 잔금을 낼 수 없다
    await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'BALANCE' })
      .expect(400);

    await prisma.estimateRequest.update({
      where: { id: estimateRequest.id },
      data: { status: 'COMPLETED' },
    });
    const balanceOrder = await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'BALANCE' })
      .expect(200);
    expect(balanceOrder.body.data.amount).toBe(900_000);

    await confirmWith(balanceOrder.body.data.orderId, 900_000, 'key-2').expect(
      200
    );

    const settled = await agent
      .get(`/estimates/${estimate.id}/payments`)
      .expect(200);
    expect(settled.body.data).toMatchObject({
      isSettled: true,
      canPayDeposit: false,
      canPayBalance: false,
    });
    expect(settled.body.data.deposit.status).toBe('PAID');
    expect(settled.body.data.balance.status).toBe('PAID');
  });

  test('토스가 거절하면 400 으로 사유를 내려주고, 다시 주문하면 새 주문번호를 받는다', async () => {
    const { customer, estimate } = await setup();
    const agent = await loginAs(customer);
    const { TossApiError } = jest.requireActual(
      '../../src/modules/payment/tossClient'
    );

    const order = await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(200);

    toss.confirm.mockRejectedValueOnce(
      new TossApiError(400, 'REJECT_CARD_COMPANY', '카드사에서 거절했습니다.')
    );
    const failed = await agent
      .post('/payments/confirm')
      .send({
        paymentKey: 'key-x',
        orderId: order.body.data.orderId,
        amount: 100_000,
      })
      .expect(400);
    expect(failed.body.error.message).toContain('카드사에서 거절했습니다.');

    const status = await agent
      .get(`/estimates/${estimate.id}/payments`)
      .expect(200);
    expect(status.body.data.deposit.status).toBe('FAILED');
    expect(status.body.data.canPayDeposit).toBe(true);

    const retry = await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(200);
    expect(retry.body.data.orderId).not.toBe(order.body.data.orderId);
  });

  test('확정되지 않은 견적은 주문할 수 없다', async () => {
    const { customer, estimate } = await setup();
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'PROPOSED' },
    });
    const agent = await loginAs(customer);

    await agent
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(400);
  });

  test('본인 견적이 아니면 403, 기사님은 403, 비로그인은 401, body 가 잘못되면 400', async () => {
    const { customer, mover, estimate } = await setup();
    const stranger = await loginAs(await createCustomer());

    await stranger.get(`/estimates/${estimate.id}/payments`).expect(403);
    await stranger
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'DEPOSIT' })
      .expect(403);
    await (
      await loginAs(mover)
    )
      .get(`/estimates/${estimate.id}/payments`)
      .expect(403);
    await request(app).get(`/estimates/${estimate.id}/payments`).expect(401);
    await request(app)
      .post('/payments/confirm')
      .send({ paymentKey: 'k', orderId: 'order-12345', amount: 1 })
      .expect(401);

    const owner = await loginAs(customer);
    await owner
      .post(`/estimates/${estimate.id}/payments`)
      .send({ type: 'FULL' })
      .expect(400);
  });
});
