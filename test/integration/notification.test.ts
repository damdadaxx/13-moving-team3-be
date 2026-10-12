import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { createCustomer, loginAs } from '../fixtures';
import { resetDatabase } from '../resetDatabase';

const seedNotifications = (userId: string, count: number) =>
  Promise.all(
    Array.from({ length: count }, (_, index) =>
      prisma.notification.create({
        data: {
          userId,
          type: 'NEW_ESTIMATE',
          content: `새 견적 알림 ${index + 1}`,
        },
      })
    )
  );

describe('/notifications', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  test('목록과 안 읽은 개수를 조회한다', async () => {
    const customer = await createCustomer();
    await seedNotifications(customer.id, 2);
    const agent = await loginAs(customer);

    const list = await agent.get('/notifications').expect(200);
    expect(JSON.stringify(list.body.data)).toContain('새 견적 알림 1');

    const unread = await agent.get('/notifications/unread-count').expect(200);
    expect(unread.body.data.unreadCount).toBe(2);
  });

  test('PATCH /:id/read 로 하나를 읽고, /read-all 로 전부 읽는다', async () => {
    const customer = await createCustomer();
    const [first] = await seedNotifications(customer.id, 3);
    const agent = await loginAs(customer);

    await agent.patch(`/notifications/${first.id}/read`).expect(200);
    let unread = await agent.get('/notifications/unread-count');
    expect(unread.body.data.unreadCount).toBe(2);

    await agent.patch('/notifications/read-all').expect(200);
    unread = await agent.get('/notifications/unread-count');
    expect(unread.body.data.unreadCount).toBe(0);
  });

  test('남의 알림은 읽음 처리할 수 없다 (404)', async () => {
    const owner = await createCustomer();
    const [notification] = await seedNotifications(owner.id, 1);
    const stranger = await loginAs(await createCustomer());

    await stranger.patch(`/notifications/${notification.id}/read`).expect(404);

    const after = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(after?.isRead).toBe(false);
  });

  test('비로그인은 401', async () => {
    await request(app).get('/notifications').expect(401);
  });
});
