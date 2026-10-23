import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import {
  createCustomer,
  createEstimateRequest,
  createMover,
  loginAs,
} from '../fixtures';
import { resetDatabase } from '../resetDatabase';

type Row = { paymentId: string; status: string; type: string };

// 이사가 끝난(COMPLETED) 요청 + 확정 견적을 만들고 결제 한 건을 붙인다
const addPayment = async (
  customerId: string,
  moverId: string,
  payment: {
    status: 'PAID' | 'FAILED' | 'READY';
    type?: 'DEPOSIT' | 'BALANCE';
    paidAt?: Date;
  }
) => {
  const estimateRequest = await createEstimateRequest(customerId, {
    status: 'COMPLETED',
    moveDate: new Date('2026-01-01T00:00:00Z'),
  });
  const estimate = await prisma.estimate.create({
    data: {
      estimateRequestId: estimateRequest.id,
      moverId,
      price: 1_000_000n,
      status: 'ACCEPTED',
    },
  });
  return prisma.payment.create({
    data: {
      estimateId: estimate.id,
      type: payment.type ?? 'DEPOSIT',
      orderId: `moving_${estimate.id}`,
      amount: 100_000n,
      status: payment.status,
      paidAt: payment.paidAt ?? null,
    },
  });
};

describe('GET /payments (결제내역)', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('본인의 결제 완료 건만 결제 완료 시각 최신순으로 보여 주고, 커서로 이어 본다', async () => {
    const customer = await createCustomer();
    const stranger = await createCustomer();
    const mover = await createMover({ name: '김기사' });

    const oldest = await addPayment(customer.id, mover.id, {
      status: 'PAID',
      paidAt: new Date('2026-10-01T00:00:00Z'),
    });
    const newest = await addPayment(customer.id, mover.id, {
      status: 'PAID',
      type: 'BALANCE',
      paidAt: new Date('2026-10-03T00:00:00Z'),
    });
    const middle = await addPayment(customer.id, mover.id, {
      status: 'PAID',
      paidAt: new Date('2026-10-02T00:00:00Z'),
    });
    await addPayment(customer.id, mover.id, { status: 'FAILED' });
    await addPayment(customer.id, mover.id, { status: 'READY' });
    await addPayment(stranger.id, mover.id, {
      status: 'PAID',
      paidAt: new Date('2026-10-04T00:00:00Z'),
    });
    const agent = await loginAs(customer);

    const first = await agent.get('/payments?size=2').expect(200);
    expect(first.body.data.totalCount).toBe(3);
    expect(first.body.data.list.map((row: Row) => row.paymentId)).toEqual([
      newest.id,
      middle.id,
    ]);
    expect(first.body.data.nextCursor).toBe(middle.id);
    expect(first.body.data.list[0]).toMatchObject({
      type: 'BALANCE',
      amount: 100_000,
      status: 'PAID',
      orderName: '김기사 기사님 이사 잔금',
      estimate: {
        serviceType: 'HOME_MOVE',
        price: 1_000_000,
        mover: { moverId: mover.id },
      },
    });

    const second = await agent
      .get(`/payments?size=2&cursor=${first.body.data.nextCursor}`)
      .expect(200);
    expect(second.body.data.list.map((row: Row) => row.paymentId)).toEqual([
      oldest.id,
    ]);
    expect(second.body.data.nextCursor).toBeNull();
  });

  test('status 로 실패·전체를 고를 수 있고, 시각이 없는 건은 뒤로 간다', async () => {
    const customer = await createCustomer();
    const mover = await createMover();
    await addPayment(customer.id, mover.id, {
      status: 'READY',
    });
    await addPayment(customer.id, mover.id, {
      status: 'PAID',
      paidAt: new Date('2026-10-01T00:00:00Z'),
    });
    await addPayment(customer.id, mover.id, { status: 'FAILED' });
    const agent = await loginAs(customer);

    const failed = await agent.get('/payments?status=FAILED').expect(200);
    expect(failed.body.data.list.map((row: Row) => row.status)).toEqual([
      'FAILED',
    ]);

    const all = await agent.get('/payments?status=ALL').expect(200);
    expect(all.body.data.totalCount).toBe(3);
    expect(all.body.data.list[0].status).toBe('PAID');
  });

  test('기사님은 403, 비로그인은 401, status 가 잘못되면 400', async () => {
    const mover = await createMover();
    const customer = await createCustomer();

    await (await loginAs(mover)).get('/payments').expect(403);
    await request(app).get('/payments').expect(401);
    await (await loginAs(customer)).get('/payments?status=DONE').expect(400);
  });
});
