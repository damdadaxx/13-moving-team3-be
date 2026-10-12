import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import type { EstimateStatus } from '../../src/generated/prisma/client';
import {
  createCustomer,
  createEstimateRequest,
  createMover,
  daysFromNow,
  loginAs,
} from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const REVIEW = { content: '친절하고 빠르게 옮겨 주셨어요.', rating: 5 };

// 이사가 끝난(COMPLETED) 요청과 그 요청의 견적
const setupFinishedMove = async (
  estimateStatus: EstimateStatus = 'ACCEPTED'
) => {
  const customer = await createCustomer();
  const mover = await createMover();
  const estimateRequest = await createEstimateRequest(customer.id, {
    status: 'COMPLETED',
    moveDate: daysFromNow(-3),
  });
  const estimate = await prisma.estimate.create({
    data: {
      estimateRequestId: estimateRequest.id,
      moverId: mover.id,
      price: 300000,
      status: estimateStatus,
    },
  });
  return { customer, mover, estimate };
};

describe('/reviews', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('POST /: 완료된 이사의 확정 견적에 리뷰를 쓰면 201, 같은 견적에 다시 쓰면 400', async () => {
    const { customer, estimate } = await setupFinishedMove();
    const agent = await loginAs(customer);

    await agent
      .post('/reviews')
      .send({ estimateId: estimate.id, ...REVIEW })
      .expect(201);
    await agent
      .post('/reviews')
      .send({ estimateId: estimate.id, ...REVIEW })
      .expect(400);
  });

  test('POST /: 확정하지 않은(탈락) 견적은 400, 남의 견적은 403', async () => {
    const notSelected = await setupFinishedMove('NOT_SELECTED');
    const owner = await loginAs(notSelected.customer);
    await owner
      .post('/reviews')
      .send({ estimateId: notSelected.estimate.id, ...REVIEW })
      .expect(400);

    const { estimate } = await setupFinishedMove();
    const stranger = await loginAs(await createCustomer());
    await stranger
      .post('/reviews')
      .send({ estimateId: estimate.id, ...REVIEW })
      .expect(403);
  });

  test('POST /: 평점이 5 를 넘으면 400 VALIDATION_ERROR', async () => {
    const { customer, estimate } = await setupFinishedMove();
    const agent = await loginAs(customer);

    const response = await agent
      .post('/reviews')
      .send({ estimateId: estimate.id, ...REVIEW, rating: 6 })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /mover/:moverId: 비로그인으로 기사님 리뷰를 조회한다', async () => {
    const { customer, mover, estimate } = await setupFinishedMove();
    await (
      await loginAs(customer)
    )
      .post('/reviews')
      .send({ estimateId: estimate.id, ...REVIEW })
      .expect(201);

    const response = await request(app)
      .get(`/reviews/mover/${mover.id}`)
      .expect(200);

    expect(JSON.stringify(response.body.data)).toContain(REVIEW.content);
  });
});
