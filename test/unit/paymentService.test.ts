import { Role } from '../../src/generated/prisma/client';
import { paymentService } from '../../src/modules/payment/paymentService';
import { paymentRepository } from '../../src/modules/payment/paymentRepository';
import { TossApiError, tossClient } from '../../src/modules/payment/tossClient';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../src/utils/error';

jest.mock('../../src/modules/payment/paymentRepository');
jest.mock('../../src/modules/payment/tossClient', () => ({
  ...jest.requireActual('../../src/modules/payment/tossClient'),
  tossClient: { confirm: jest.fn(), getPayment: jest.fn() },
}));

const findEstimate = jest.mocked(paymentRepository.findEstimateForPayment);
const findByEstimateId = jest.mocked(paymentRepository.findByEstimateId);
const findByOrderId = jest.mocked(paymentRepository.findByOrderId);
const createOrGet = jest.mocked(paymentRepository.createOrGet);
const resetForRetry = jest.mocked(paymentRepository.resetForRetry);
const markFailed = jest.mocked(paymentRepository.markFailed);
const markPaid = jest.mocked(paymentRepository.markPaid);
const toss = jest.mocked(tossClient);

type Estimate = NonNullable<Awaited<ReturnType<typeof findEstimate>>>;
type Payment = Awaited<ReturnType<typeof createOrGet>>;

const CUSTOMER = 'customer-1';
const ESTIMATE = 'estimate-1';

const estimate = (
  overrides: { status?: string; requestStatus?: string; price?: bigint } = {}
) =>
  ({
    id: ESTIMATE,
    status: overrides.status ?? 'ACCEPTED',
    price: overrides.price ?? 1_000_005n,
    mover: { user: { name: '김기사' } },
    estimateRequest: {
      customerId: CUSTOMER,
      status: overrides.requestStatus ?? 'CONFIRMED',
      customer: { user: { name: '홍고객' } },
    },
  }) as unknown as Estimate;

const payment = (overrides: Partial<Payment> = {}) =>
  ({
    id: 'payment-1',
    estimateId: ESTIMATE,
    type: 'DEPOSIT',
    orderId: 'moving_order-1',
    amount: 100_000n,
    status: 'READY',
    paymentKey: null,
    failureMessage: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Payment;

beforeEach(() => {
  jest.resetAllMocks();
  findEstimate.mockResolvedValue(estimate());
  findByEstimateId.mockResolvedValue([]);
});

describe('paymentService.getPayments', () => {
  test('금액은 가격에서 서버가 계산한다 (선수금 = 내림한 10%, 잔금 = 나머지)', async () => {
    const result = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );

    expect(result).toMatchObject({
      price: 1_000_005,
      depositAmount: 100_000,
      balanceAmount: 900_005,
      canPayDeposit: true,
      canPayBalance: false,
      isSettled: false,
    });
  });

  test('선수금을 내고 이사가 완료되면 잔금을 낼 수 있다', async () => {
    findEstimate.mockResolvedValue(estimate({ requestStatus: 'COMPLETED' }));
    findByEstimateId.mockResolvedValue([
      payment({ status: 'PAID', paidAt: new Date('2026-10-20T00:00:00Z') }),
    ]);

    const result = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );

    expect(result.canPayDeposit).toBe(false);
    expect(result.canPayBalance).toBe(true);
    expect(result.deposit).toMatchObject({
      type: 'DEPOSIT',
      status: 'PAID',
      amount: 100_000,
      paidAt: '2026-10-20T00:00:00.000Z',
    });
  });

  test('이사 완료 전에는 선수금을 냈어도 잔금을 낼 수 없다', async () => {
    findByEstimateId.mockResolvedValue([payment({ status: 'PAID' })]);

    const result = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );

    expect(result.canPayBalance).toBe(false);
  });

  test('잔금까지 PAID 이면 정산 완료다', async () => {
    findEstimate.mockResolvedValue(estimate({ requestStatus: 'COMPLETED' }));
    findByEstimateId.mockResolvedValue([
      payment({ status: 'PAID' }),
      payment({ id: 'p2', type: 'BALANCE', status: 'PAID' }),
    ]);

    const result = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );

    expect(result).toMatchObject({
      isSettled: true,
      canPayDeposit: false,
      canPayBalance: false,
    });
  });

  test('본인 견적이 아니거나 고객이 아니면 403, 없으면 404', async () => {
    await expect(
      paymentService.getPayments('other', Role.CUSTOMER, ESTIMATE)
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      paymentService.getPayments(CUSTOMER, Role.MOVER, ESTIMATE)
    ).rejects.toBeInstanceOf(ForbiddenError);

    findEstimate.mockResolvedValue(null);
    await expect(
      paymentService.getPayments(CUSTOMER, Role.CUSTOMER, ESTIMATE)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('paymentService.createOrder', () => {
  test('확정된 견적이면 선수금 주문을 만든다', async () => {
    createOrGet.mockImplementation(async (data) =>
      payment({ orderId: data.orderId, amount: BigInt(data.amount) })
    );

    const result = await paymentService.createOrder(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE,
      { type: 'DEPOSIT' }
    );

    expect(createOrGet).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DEPOSIT', amount: 100_000 })
    );
    expect(result).toMatchObject({
      amount: 100_000,
      orderName: '김기사 기사님 이사 선수금',
      customerKey: CUSTOMER,
      customerName: '홍고객',
    });
    expect(result.orderId).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
  });

  test('이미 READY 주문이 있으면 새로 만들지 않고 재사용한다', async () => {
    findByEstimateId.mockResolvedValue([payment()]);

    const result = await paymentService.createOrder(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE,
      { type: 'DEPOSIT' }
    );

    expect(result.orderId).toBe('moving_order-1');
    expect(createOrGet).not.toHaveBeenCalled();
    expect(resetForRetry).not.toHaveBeenCalled();
  });

  test('거절됐던 주문은 새 주문번호로 다시 연다', async () => {
    findByEstimateId.mockResolvedValue([payment({ status: 'FAILED' })]);
    resetForRetry.mockImplementation(async (_id, orderId) =>
      payment({ orderId })
    );

    const result = await paymentService.createOrder(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE,
      { type: 'DEPOSIT' }
    );

    expect(resetForRetry).toHaveBeenCalledWith('payment-1', expect.any(String));
    expect(result.orderId).not.toBe('moving_order-1');
  });

  test('이미 결제했으면 409, 조건이 안 맞으면 400', async () => {
    findByEstimateId.mockResolvedValue([payment({ status: 'PAID' })]);
    await expect(
      paymentService.createOrder(CUSTOMER, Role.CUSTOMER, ESTIMATE, {
        type: 'DEPOSIT',
      })
    ).rejects.toBeInstanceOf(ConflictError);

    // 선수금만 냈고 이사가 끝나지 않은 상태의 잔금
    await expect(
      paymentService.createOrder(CUSTOMER, Role.CUSTOMER, ESTIMATE, {
        type: 'BALANCE',
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    // 확정되지 않은 견적의 선수금
    findByEstimateId.mockResolvedValue([]);
    findEstimate.mockResolvedValue(estimate({ status: 'PROPOSED' }));
    await expect(
      paymentService.createOrder(CUSTOMER, Role.CUSTOMER, ESTIMATE, {
        type: 'DEPOSIT',
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('paymentService.confirm', () => {
  const input = {
    paymentKey: 'toss-key-1',
    orderId: 'moving_order-1',
    amount: 100_000,
  };
  const withEstimate = (row: Payment) =>
    ({ ...row, estimate: estimate() }) as unknown as NonNullable<
      Awaited<ReturnType<typeof findByOrderId>>
    >;

  test('주문과 금액이 맞으면 토스 승인 후 PAID 로 저장한다', async () => {
    findByOrderId.mockResolvedValue(withEstimate(payment()));
    toss.confirm.mockResolvedValue({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      status: 'DONE',
      totalAmount: 100_000,
      approvedAt: '2026-10-20T01:00:00+09:00',
    });
    markPaid.mockResolvedValue(
      payment({
        status: 'PAID',
        paymentKey: input.paymentKey,
        paidAt: new Date('2026-10-19T16:00:00Z'),
      })
    );

    const result = await paymentService.confirm(CUSTOMER, Role.CUSTOMER, input);

    expect(toss.confirm).toHaveBeenCalledWith(input);
    expect(markPaid).toHaveBeenCalledWith(
      'payment-1',
      'toss-key-1',
      new Date('2026-10-20T01:00:00+09:00')
    );
    expect(result).toMatchObject({
      estimateId: ESTIMATE,
      type: 'DEPOSIT',
      amount: 100_000,
      status: 'PAID',
    });
  });

  test('클라이언트 금액이 주문과 다르면 토스를 부르지 않고 400', async () => {
    findByOrderId.mockResolvedValue(withEstimate(payment()));

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, { ...input, amount: 1 })
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(toss.confirm).not.toHaveBeenCalled();
  });

  test('이미 PAID 인 주문은 같은 결제 키면 토스를 다시 부르지 않고 성공한다', async () => {
    findByOrderId.mockResolvedValue(
      withEstimate(
        payment({
          status: 'PAID',
          paymentKey: input.paymentKey,
          paidAt: new Date(),
        })
      )
    );

    const result = await paymentService.confirm(CUSTOMER, Role.CUSTOMER, input);

    expect(result.status).toBe('PAID');
    expect(toss.confirm).not.toHaveBeenCalled();

    findByOrderId.mockResolvedValue(
      withEstimate(payment({ status: 'PAID', paymentKey: 'another' }))
    );
    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('토스가 거절하면 FAILED 로 기록하고 사유를 메시지로 돌려준다', async () => {
    findByOrderId.mockResolvedValue(withEstimate(payment()));
    toss.confirm.mockRejectedValue(
      new TossApiError(400, 'REJECT_CARD_COMPANY', '카드사에서 거절했습니다.')
    );

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toThrow('카드사에서 거절했습니다.');
    expect(markFailed).toHaveBeenCalledWith(
      'payment-1',
      expect.stringContaining('REJECT_CARD_COMPANY')
    );
    expect(markPaid).not.toHaveBeenCalled();
  });

  test('토스 서버 오류는 결과를 알 수 없어 FAILED 로 기록하지 않고 503', async () => {
    findByOrderId.mockResolvedValue(withEstimate(payment()));
    toss.confirm.mockRejectedValue(
      new TossApiError(500, 'FAILED_INTERNAL_SYSTEM_PROCESSING', '내부 오류')
    );

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(markFailed).not.toHaveBeenCalled();
  });

  test('토스에서 이미 처리된 결제면 조회로 확인해 PAID 로 이어간다', async () => {
    findByOrderId.mockResolvedValue(withEstimate(payment()));
    toss.confirm.mockRejectedValue(
      new TossApiError(409, 'ALREADY_PROCESSED_PAYMENT', '이미 처리됨')
    );
    toss.getPayment.mockResolvedValue({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      status: 'DONE',
      totalAmount: 100_000,
      approvedAt: null,
    });
    markPaid.mockResolvedValue(payment({ status: 'PAID' }));

    const result = await paymentService.confirm(CUSTOMER, Role.CUSTOMER, input);

    expect(result.status).toBe('PAID');
    expect(markFailed).not.toHaveBeenCalled();
  });

  test('주문이 없으면 404, 다른 고객의 주문이면 403', async () => {
    findByOrderId.mockResolvedValue(null);
    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(NotFoundError);

    findByOrderId.mockResolvedValue(withEstimate(payment()));
    await expect(
      paymentService.confirm('other', Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
