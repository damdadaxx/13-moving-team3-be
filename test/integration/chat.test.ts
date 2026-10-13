import { randomUUID } from 'node:crypto';
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

const createChatEstimate = async (
  customerId: string,
  moverId: string,
  status: {
    estimate?: 'ACCEPTED' | 'PROPOSED';
    request?: 'CONFIRMED' | 'COMPLETED' | 'PENDING';
  } = {}
) => {
  const estimateRequest = await createEstimateRequest(customerId, {
    status: status.request ?? 'CONFIRMED',
  });
  const estimate = await prisma.estimate.create({
    data: {
      estimateRequestId: estimateRequest.id,
      moverId,
      price: 200000,
      status: status.estimate ?? 'ACCEPTED',
    },
  });
  return estimate;
};

describe('/chat/rooms', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('로그인하지 않으면 401', async () => {
    await request(app).get('/chat/rooms').expect(401);
    await request(app).get(`/chat/rooms/${randomUUID()}/messages`).expect(401);
  });

  test('참여 중인 확정 채팅이 없으면 빈 목록', async () => {
    const customer = await loginAs(await createCustomer());

    const response = await customer.get('/chat/rooms').expect(200);

    expect(response.body.data).toEqual({ list: [] });
  });

  test('없는 견적이면 404', async () => {
    const customer = await loginAs(await createCustomer());

    const response = await customer
      .get(`/chat/rooms/${randomUUID()}/messages`)
      .expect(404);

    expect(response.body.error.message).toBe('견적을 찾을 수 없습니다.');
  });

  test('참여자가 아니면 403', async () => {
    const customer = await createCustomer();
    const mover = await createMover();
    const stranger = await createCustomer();
    const estimate = await createChatEstimate(customer.id, mover.id);
    const agent = await loginAs(stranger);

    const response = await agent
      .get(`/chat/rooms/${estimate.id}/messages`)
      .expect(403);

    expect(response.body.error.message).toBe('본인의 채팅방이 아닙니다.');
    await agent.patch(`/chat/rooms/${estimate.id}/read`).expect(403);
  });

  test('확정되지 않은 견적이면 참여자도 403', async () => {
    const customer = await createCustomer();
    const mover = await createMover();
    const estimate = await createChatEstimate(customer.id, mover.id, {
      estimate: 'PROPOSED',
      request: 'PENDING',
    });
    const agent = await loginAs(customer);

    const response = await agent
      .get(`/chat/rooms/${estimate.id}/unread-count`)
      .expect(403);

    expect(response.body.error.message).toBe(
      '확정된 견적의 채팅만 이용할 수 있습니다.'
    );
  });

  test('요청이 확정·완료가 아니면 403', async () => {
    const customer = await createCustomer();
    const mover = await createMover();
    const estimate = await createChatEstimate(customer.id, mover.id, {
      request: 'PENDING',
    });
    const agent = await loginAs(mover);

    const response = await agent
      .get(`/chat/rooms/${estimate.id}/messages`)
      .expect(403);

    expect(response.body.error.message).toBe(
      '현재 상태에서는 채팅을 이용할 수 없습니다.'
    );
  });

  test('이사 완료 후에는 메시지 전송과 이미지 업로드가 403', async () => {
    const customer = await createCustomer();
    const mover = await createMover();
    const estimate = await createChatEstimate(customer.id, mover.id, {
      request: 'COMPLETED',
    });
    const agent = await loginAs(customer);

    const send = await agent
      .post(`/chat/rooms/${estimate.id}/messages`)
      .send({ content: '아직 계신가요?' })
      .expect(403);
    expect(send.body.error.message).toBe(
      '이사 완료 후에는 기록 조회만 가능합니다.'
    );

    const upload = await agent
      .post(`/chat/rooms/${estimate.id}/image`)
      .send({ fileName: 'photo.png' })
      .expect(403);
    expect(upload.body.error.message).toBe(
      '이사 완료 후에는 기록 조회만 가능합니다.'
    );
  });
});
