import { Role } from '../../src/generated/prisma/client';
import { paymentService } from '../../src/modules/payment/paymentService';
import { paymentRepository } from '../../src/modules/payment/paymentRepository';
import { TossApiError, tossClient } from '../../src/modules/payment/tossClient';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
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
const markFailed = jest.mocked(paymentRepository.markFailed);
const markPaid = jest.mocked(paymentRepository.markPaid);
const savePaymentKey = jest.mocked(paymentRepository.savePaymentKey);
const findHistory = jest.mocked(paymentRepository.findHistory);
const countHistory = jest.mocked(paymentRepository.countHistory);
const toss = jest.mocked(tossClient);

type Estimate = NonNullable<Awaited<ReturnType<typeof findEstimate>>>;
type Payment = Awaited<ReturnType<typeof paymentRepository.createOrGet>>;

const CUSTOMER = 'customer-1';
const ESTIMATE = 'estimate-1';

const estimate = () =>
  ({
    id: ESTIMATE,
    status: 'ACCEPTED',
    price: 1_000_000n,
    mover: { user: { name: '김기사' } },
    estimateRequest: {
      customerId: CUSTOMER,
      status: 'CONFIRMED',
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

const withEstimate = (row: Payment) =>
  ({ ...row, estimate: estimate() }) as unknown as NonNullable<
    Awaited<ReturnType<typeof findByOrderId>>
  >;

const input = {
  paymentKey: 'toss-key-1',
  orderId: 'moving_order-1',
  amount: 100_000,
};

const tossPayment = (status: string, overrides = {}) => ({
  paymentKey: input.paymentKey,
  orderId: input.orderId,
  status,
  totalAmount: 100_000,
  approvedAt: null,
  ...overrides,
});

const alreadyProcessed = () =>
  new TossApiError(409, 'ALREADY_PROCESSED_PAYMENT', '이미 처리됨');

beforeEach(() => {
  jest.resetAllMocks();
  findEstimate.mockResolvedValue(estimate());
  findByEstimateId.mockResolvedValue([]);
  findByOrderId.mockResolvedValue(withEstimate(payment()));
});

describe('paymentService.confirm - DONE 이 아닌 결제와 조회 오류', () => {
  test('승인 결과가 DONE 이 아니면 FAILED 로 내리지 않고 결제 키만 남긴 채 409', async () => {
    toss.confirm.mockResolvedValue(tossPayment('WAITING_FOR_DEPOSIT'));

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(savePaymentKey).toHaveBeenCalledWith('payment-1', 'toss-key-1');
    expect(markFailed).not.toHaveBeenCalled();
    expect(markPaid).not.toHaveBeenCalled();
  });

  test('이미 처리된 결제를 조회했더니 입금 대기면 FAILED 로 내리지 않는다', async () => {
    toss.confirm.mockRejectedValue(alreadyProcessed());
    toss.getPayment.mockResolvedValue(tossPayment('WAITING_FOR_DEPOSIT'));

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(savePaymentKey).toHaveBeenCalledWith('payment-1', 'toss-key-1');
    expect(markFailed).not.toHaveBeenCalled();
  });

  test('조회 결과가 취소·만료 같은 종료 상태면 FAILED 로 기록한다', async () => {
    toss.confirm.mockRejectedValue(alreadyProcessed());
    toss.getPayment.mockResolvedValue(tossPayment('CANCELED'));

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(markFailed).toHaveBeenCalledWith(
      'payment-1',
      expect.stringContaining('CANCELED')
    );
  });

  test('조회 중 토스 서버 오류는 500 이 아니라 503 이고 상태를 바꾸지 않는다', async () => {
    toss.confirm.mockRejectedValue(alreadyProcessed());
    toss.getPayment.mockRejectedValue(
      new TossApiError(500, 'FAILED_INTERNAL_SYSTEM_PROCESSING', '내부 오류')
    );

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(markFailed).not.toHaveBeenCalled();
  });

  test('조회가 4xx 로 거절되면 사유와 함께 400 으로 FAILED 기록한다', async () => {
    toss.confirm.mockRejectedValue(alreadyProcessed());
    toss.getPayment.mockRejectedValue(
      new TossApiError(404, 'NOT_FOUND_PAYMENT', '존재하지 않는 결제 정보')
    );

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toThrow('존재하지 않는 결제 정보');
    expect(markFailed).toHaveBeenCalled();
  });

  test('결제 키가 다른 주문의 것이면 400 으로 거절만 하고 상태는 바꾸지 않는다', async () => {
    toss.confirm.mockResolvedValue(tossPayment('DONE', { orderId: 'other' }));

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, input)
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(markFailed).not.toHaveBeenCalled();
    expect(markPaid).not.toHaveBeenCalled();
  });

  test('승인 대기 중인 주문은 다시 주문할 수 없고, 같은 결제 키로만 다시 확인할 수 있다', async () => {
    const waiting = payment({ paymentKey: 'toss-key-1' });
    findByOrderId.mockResolvedValue(withEstimate(waiting));
    findByEstimateId.mockResolvedValue([waiting]);

    await expect(
      paymentService.confirm(CUSTOMER, Role.CUSTOMER, {
        ...input,
        paymentKey: 'another',
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      paymentService.createOrder(CUSTOMER, Role.CUSTOMER, ESTIMATE, {
        type: 'DEPOSIT',
      })
    ).rejects.toBeInstanceOf(ConflictError);

    const status = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );
    expect(status.canPayDeposit).toBe(false);

    // 같은 결제 키로 다시 확인하면, 입금이 끝난 뒤 PAID 로 이어진다
    toss.confirm.mockRejectedValue(alreadyProcessed());
    toss.getPayment.mockResolvedValue(
      tossPayment('DONE', { approvedAt: '2026-10-21T00:00:00+09:00' })
    );
    markPaid.mockResolvedValue(
      payment({ status: 'PAID', paymentKey: 'toss-key-1' })
    );

    const result = await paymentService.confirm(CUSTOMER, Role.CUSTOMER, input);
    expect(result.status).toBe('PAID');
  });
});

describe('paymentService.getPayments - 거절 사유', () => {
  test('거절된 결제는 사유를 함께 돌려준다', async () => {
    findByEstimateId.mockResolvedValue([
      payment({ status: 'FAILED', failureMessage: '카드사에서 거절했습니다.' }),
    ]);

    const result = await paymentService.getPayments(
      CUSTOMER,
      Role.CUSTOMER,
      ESTIMATE
    );

    expect(result.deposit).toMatchObject({
      status: 'FAILED',
      failureMessage: '카드사에서 거절했습니다.',
    });
    expect(result.canPayDeposit).toBe(true);
  });
});

describe('paymentService.getPaymentHistory (결제내역)', () => {
  const historyRow = (id: string) =>
    ({
      ...payment({
        id,
        status: 'PAID',
        paidAt: new Date('2026-10-20T00:00:00Z'),
      }),
      estimate: {
        id: ESTIMATE,
        price: 1_000_000n,
        mover: {
          userId: 'mover-1',
          nickname: '민재 이사센터',
          user: { name: '김기사' },
        },
        estimateRequest: {
          serviceType: 'HOME_MOVE',
          moveDate: new Date('2026-10-25T00:00:00Z'),
          departureAddress: '서울 출발',
          arrivalAddress: '부산 도착',
        },
      },
    }) as unknown as Awaited<ReturnType<typeof findHistory>>[number];

  test('계약대로 항목을 만들고, 한 건 더 받아 다음 커서를 정한다', async () => {
    findHistory.mockResolvedValue([
      historyRow('p1'),
      historyRow('p2'),
      historyRow('p3'),
    ]);
    countHistory.mockResolvedValue(7);

    const result = await paymentService.getPaymentHistory(
      CUSTOMER,
      Role.CUSTOMER,
      { size: 2, status: 'PAID' }
    );

    expect(findHistory).toHaveBeenCalledWith(CUSTOMER, {
      status: 'PAID',
      cursor: undefined,
      size: 2,
    });
    expect(result.totalCount).toBe(7);
    expect(result.nextCursor).toBe('p2');
    expect(result.list).toHaveLength(2);
    expect(result.list[0]).toEqual({
      paymentId: 'p1',
      type: 'DEPOSIT',
      amount: 100_000,
      status: 'PAID',
      paidAt: '2026-10-20T00:00:00.000Z',
      failureMessage: null,
      orderName: '김기사 기사님 이사 선수금',
      estimate: {
        estimateId: ESTIMATE,
        serviceType: 'HOME_MOVE',
        moveDate: '2026-10-25T00:00:00.000Z',
        departureAddress: '서울 출발',
        arrivalAddress: '부산 도착',
        price: 1_000_000,
        mover: { moverId: 'mover-1', nickname: '민재 이사센터' },
      },
    });
  });

  test('마지막 페이지면 다음 커서가 null 이다', async () => {
    findHistory.mockResolvedValue([historyRow('p1')]);
    countHistory.mockResolvedValue(1);

    const result = await paymentService.getPaymentHistory(
      CUSTOMER,
      Role.CUSTOMER,
      { size: 10, status: 'ALL' }
    );

    expect(result.nextCursor).toBeNull();
  });

  test('기사님은 403', async () => {
    await expect(
      paymentService.getPaymentHistory(CUSTOMER, Role.MOVER, {
        size: 10,
        status: 'PAID',
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(findHistory).not.toHaveBeenCalled();
  });
});
