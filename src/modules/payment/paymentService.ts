import { randomUUID } from 'node:crypto';
import {
  EstimateRequestStatus,
  EstimateStatus,
  PaymentStatus,
  PaymentType,
  Role,
} from '../../generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../utils/error';
import { paginateByCursor } from '../../utils/cursorPagination';
import { paymentRepository } from './paymentRepository';
import { TossApiError, tossClient, type TossPayment } from './tossClient';
import type {
  ConfirmPaymentDto,
  CreatePaymentBodyDto,
  GetPaymentHistoryQueryDto,
  PaymentParamsDto,
} from './paymentSchema';

/*=================================================
결제 (선수금 10% → 이사 완료 후 잔금 90%)
=================================================*/
/*
@ 가이드
- 금액은 항상 서버가 견적 가격에서 계산한다. 클라이언트가 보낸 금액은 주문과 대조만 한다.
  선수금 = floor(가격 × 0.1), 잔금 = 가격 − 선수금
- 견적당 선수금·잔금은 한 건씩이다. 결제가 거절되면 같은 행을 새 주문번호로 다시 연다.
@ 주의사항
- 토스가 4xx 로 거절하면 FAILED, 5xx·통신 오류는 결과를 알 수 없어 READY 로 둔다.
  같은 orderId 는 멱등 키로 보내므로 다시 시도해도 이중 승인되지 않는다.
- 승인 결과가 DONE 이 아닌 결제(가상계좌의 입금 대기 등)는 FAILED 로 내리지 않는다.
  결제 키를 남긴 READY 로 두어 같은 견적을 다시 결제하지 못하게 막는다.
  (입금 확인은 웹훅이 있어야 자동 반영된다. 지금은 카드 결제만 쓰는 것을 전제로 한다.)
- 환불·취소·웹훅·정산은 아직 다루지 않는다.
*/
const DEPOSIT_RATE = 0.1;
const TOSS_DONE = 'DONE';
// 토스가 더 이상 승인될 수 없다고 알려 주는 상태
const TOSS_FINAL_FAILED = [
  'CANCELED',
  'PARTIAL_CANCELED',
  'ABORTED',
  'EXPIRED',
];

type EstimateForPayment = NonNullable<
  Awaited<ReturnType<typeof paymentRepository.findEstimateForPayment>>
>;
type PaymentRow = Awaited<ReturnType<typeof paymentRepository.createOrGet>>;

const calculateAmounts = (price: bigint | null) => {
  const total = price === null ? 0 : Number(price);
  const depositAmount = Math.floor(total * DEPOSIT_RATE);
  return { price: total, depositAmount, balanceAmount: total - depositAmount };
};

const toPaymentInfo = (payment: PaymentRow) => ({
  paymentId: payment.id,
  type: payment.type,
  amount: Number(payment.amount),
  status: payment.status,
  paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  // 거절된 결제의 사유 (결제 현황에서도 이유를 보여 줄 수 있게)
  failureMessage: payment.failureMessage,
});

const newOrderId = () => `moving_${randomUUID()}`;

const orderNameOf = (moverName: string, type: PaymentType) =>
  `${moverName} 기사님 이사 ${type === PaymentType.DEPOSIT ? '선수금' : '잔금'}`;

const isPaid = (payment?: { status: PaymentStatus }) =>
  payment?.status === PaymentStatus.PAID;

// 승인 결과를 기다리는 결제: 결제 키가 있는데 아직 PAID 가 아닌 READY
const isInProgress = (payment?: {
  status: PaymentStatus;
  paymentKey: string | null;
}) => payment?.status === PaymentStatus.READY && payment.paymentKey !== null;

const canPay = (
  type: PaymentType,
  estimate: Pick<EstimateForPayment, 'status' | 'estimateRequest'>,
  payments: {
    type: PaymentType;
    status: PaymentStatus;
    paymentKey: string | null;
  }[],
  { ignoreInProgress = false } = {}
) => {
  const deposit = payments.find((row) => row.type === PaymentType.DEPOSIT);
  const balance = payments.find((row) => row.type === PaymentType.BALANCE);
  const current = type === PaymentType.DEPOSIT ? deposit : balance;

  if (isPaid(current) || (!ignoreInProgress && isInProgress(current))) {
    return false;
  }
  if (type === PaymentType.DEPOSIT) {
    return estimate.status === EstimateStatus.ACCEPTED;
  }
  return (
    isPaid(deposit) &&
    estimate.estimateRequest.status === EstimateRequestStatus.COMPLETED
  );
};

// 고객 본인의 견적인지 확인한다
const assertCustomer = (role: Role) => {
  if (role !== Role.CUSTOMER) {
    throw new ForbiddenError('고객만 결제할 수 있습니다.');
  }
};

const assertOwnedByCustomer = (
  estimate: Pick<EstimateForPayment, 'estimateRequest'>,
  userId: string,
  role: Role
) => {
  assertCustomer(role);
  if (estimate.estimateRequest.customerId !== userId) {
    throw new ForbiddenError('본인의 견적이 아닙니다.');
  }
};

const loadOwnedEstimate = async (
  estimateId: string,
  userId: string,
  role: Role
) => {
  const estimate = await paymentRepository.findEstimateForPayment(estimateId);
  if (!estimate) {
    throw new NotFoundError('견적을 찾을 수 없습니다.');
  }
  assertOwnedByCustomer(estimate, userId, role);
  return estimate;
};

export const paymentService = {
  getPayments: async (
    userId: string,
    role: Role,
    estimateId: PaymentParamsDto['estimateId']
  ) => {
    const estimate = await loadOwnedEstimate(estimateId, userId, role);
    const payments = await paymentRepository.findByEstimateId(estimateId);
    const deposit = payments.find((row) => row.type === PaymentType.DEPOSIT);
    const balance = payments.find((row) => row.type === PaymentType.BALANCE);
    const amounts = calculateAmounts(estimate.price);

    return {
      estimateId,
      price: amounts.price,
      depositAmount: amounts.depositAmount,
      balanceAmount: amounts.balanceAmount,
      deposit: deposit ? toPaymentInfo(deposit) : null,
      balance: balance ? toPaymentInfo(balance) : null,
      canPayDeposit: canPay(PaymentType.DEPOSIT, estimate, payments),
      canPayBalance: canPay(PaymentType.BALANCE, estimate, payments),
      isSettled: isPaid(balance),
    };
  },

  /** 결제내역: 고객 본인의 결제를 결제 완료 시각 최신순으로 */
  getPaymentHistory: async (
    userId: string,
    role: Role,
    { cursor, size, status }: GetPaymentHistoryQueryDto
  ) => {
    assertCustomer(role);

    const [rows, totalCount] = await Promise.all([
      paymentRepository.findHistory(userId, { status, cursor, size }),
      paymentRepository.countHistory(userId, status),
    ]);
    const { items, nextCursor } = paginateByCursor(rows, size);

    return {
      list: items.map((row) => ({
        ...toPaymentInfo(row),
        orderName: orderNameOf(row.estimate.mover.user.name, row.type),
        estimate: {
          estimateId: row.estimate.id,
          serviceType: row.estimate.estimateRequest.serviceType,
          moveDate: row.estimate.estimateRequest.moveDate.toISOString(),
          departureAddress: row.estimate.estimateRequest.departureAddress,
          arrivalAddress: row.estimate.estimateRequest.arrivalAddress,
          price: calculateAmounts(row.estimate.price).price,
          mover: {
            moverId: row.estimate.mover.userId,
            nickname: row.estimate.mover.nickname,
          },
        },
      })),
      nextCursor,
      totalCount,
    };
  },

  createOrder: async (
    userId: string,
    role: Role,
    estimateId: PaymentParamsDto['estimateId'],
    { type }: CreatePaymentBodyDto
  ) => {
    const estimate = await loadOwnedEstimate(estimateId, userId, role);
    const payments = await paymentRepository.findByEstimateId(estimateId);
    const existing = payments.find((row) => row.type === type);

    if (isPaid(existing)) {
      throw new ConflictError('이미 결제가 완료되었습니다.');
    }
    if (isInProgress(existing)) {
      throw new ConflictError(
        '승인 결과를 기다리는 결제가 있습니다. 결제내역에서 확인해 주세요.'
      );
    }
    if (!canPay(type, estimate, payments)) {
      throw new BadRequestError(
        type === PaymentType.DEPOSIT
          ? '확정된 견적만 선수금을 결제할 수 있습니다.'
          : '선수금 결제 후 이사가 완료되면 잔금을 결제할 수 있습니다.'
      );
    }

    const amounts = calculateAmounts(estimate.price);
    const amount =
      type === PaymentType.DEPOSIT
        ? amounts.depositAmount
        : amounts.balanceAmount;
    if (amount <= 0) {
      throw new BadRequestError('결제 금액이 올바르지 않습니다.');
    }

    // 결제 전(READY)이면 같은 주문을 재사용하고, 거절됐던 주문은 새 주문번호로 다시 연다
    let payment: PaymentRow;
    if (!existing) {
      payment = await paymentRepository.createOrGet({
        estimateId,
        type,
        orderId: newOrderId(),
        amount,
      });
    } else if (existing.status === PaymentStatus.FAILED) {
      payment = await paymentRepository.resetForRetry(
        existing.id,
        newOrderId()
      );
    } else {
      payment = existing;
    }

    return {
      orderId: payment.orderId,
      orderName: orderNameOf(estimate.mover.user.name, type),
      amount: Number(payment.amount),
      customerKey: userId,
      customerName: estimate.estimateRequest.customer.user.name,
    };
  },

  confirm: async (userId: string, role: Role, input: ConfirmPaymentDto) => {
    const payment = await paymentRepository.findByOrderId(input.orderId);
    if (!payment) {
      throw new NotFoundError('주문을 찾을 수 없습니다.');
    }
    assertOwnedByCustomer(payment.estimate, userId, role);

    const toResult = (row: PaymentRow) => ({
      paymentId: row.id,
      estimateId: row.estimateId,
      type: row.type,
      amount: Number(row.amount),
      status: row.status,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    });

    // 같은 승인 요청이 반복돼도 이미 결제된 주문이면 성공으로 응답한다
    if (isPaid(payment)) {
      if (payment.paymentKey !== input.paymentKey) {
        throw new ConflictError('이미 다른 결제로 완료된 주문입니다.');
      }
      return toResult(payment);
    }

    if (Number(payment.amount) !== input.amount) {
      throw new BadRequestError('결제 금액이 주문과 일치하지 않습니다.');
    }
    // 승인 대기 중인 결제는 같은 결제 키로만 다시 확인할 수 있다
    if (isInProgress(payment) && payment.paymentKey !== input.paymentKey) {
      throw new ConflictError('이미 다른 결제로 승인 대기 중인 주문입니다.');
    }

    const payments = await paymentRepository.findByEstimateId(
      payment.estimateId
    );
    if (
      !canPay(payment.type, payment.estimate, payments, {
        ignoreInProgress: true,
      })
    ) {
      throw new BadRequestError('현재 상태에서는 결제할 수 없습니다.');
    }

    const approved = await approveWithToss(payment.id, input);
    const paid = await paymentRepository.markPaid(
      payment.id,
      input.paymentKey,
      approved.approvedAt ? new Date(approved.approvedAt) : new Date()
    );
    return toResult(paid);
  },
};

// 토스 4xx 거절을 FAILED 로 기록하고 사유를 에러 메시지로 돌려준다
const failWith = async (paymentId: string, message: string) => {
  await paymentRepository.markFailed(paymentId, message);
  return new BadRequestError(message);
};

const rejectionMessage = (error: TossApiError) =>
  `결제 승인에 실패했습니다. ${error.message} (${error.code})`;

/*
@ 토스 승인
- 승인 API 가 이미 처리됐다고 하면(ALREADY_PROCESSED_PAYMENT) 결제를 조회해 상태를 확인한다.
- 결과가 DONE 이면 승인 완료, 취소·만료 같은 종료 상태면 FAILED,
  그 외(입금 대기 등)는 결제 키만 남기고 409 로 돌려보낸다. FAILED 로 내리면
  같은 견적을 한 번 더 결제할 수 있게 되기 때문이다.
- 주문과 다른 결제 키(주문번호·금액 불일치)는 거절만 하고 상태는 바꾸지 않는다.
*/
const approveWithToss = async (paymentId: string, input: ConfirmPaymentDto) => {
  let result: TossPayment;
  try {
    result = await tossClient.confirm(input);
  } catch (error) {
    if (!(error instanceof TossApiError)) throw error;
    if (error.status >= 500) throw unavailable();
    if (error.code !== 'ALREADY_PROCESSED_PAYMENT') {
      throw await failWith(paymentId, rejectionMessage(error));
    }

    try {
      result = await tossClient.getPayment(input.paymentKey);
    } catch (lookupError) {
      if (!(lookupError instanceof TossApiError)) throw lookupError;
      if (lookupError.status >= 500) throw unavailable();
      throw await failWith(paymentId, rejectionMessage(lookupError));
    }
  }

  if (result.orderId !== input.orderId || result.totalAmount !== input.amount) {
    throw new BadRequestError('결제 정보가 주문과 일치하지 않습니다.');
  }
  if (result.status === TOSS_DONE) {
    return result;
  }
  if (TOSS_FINAL_FAILED.includes(result.status)) {
    throw await failWith(
      paymentId,
      `결제가 완료되지 않았습니다. (상태: ${result.status})`
    );
  }

  await paymentRepository.savePaymentKey(paymentId, input.paymentKey);
  throw new ConflictError(
    `결제 승인이 아직 완료되지 않았습니다. (상태: ${result.status}) 결제내역에서 확인해 주세요.`
  );
};

const unavailable = () =>
  new ServiceUnavailableError(
    '결제 승인 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
  );
