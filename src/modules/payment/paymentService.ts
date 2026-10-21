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
import { paymentRepository } from './paymentRepository';
import { TossApiError, tossClient } from './tossClient';
import type {
  ConfirmPaymentDto,
  CreatePaymentBodyDto,
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
- 환불·취소·웹훅·정산은 아직 다루지 않는다.
*/
const DEPOSIT_RATE = 0.1;
const TOSS_DONE = 'DONE';

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
});

const newOrderId = () => `moving_${randomUUID()}`;

const isPaid = (payment?: { status: PaymentStatus }) =>
  payment?.status === PaymentStatus.PAID;

const canPay = (
  type: PaymentType,
  estimate: Pick<EstimateForPayment, 'status' | 'estimateRequest'>,
  payments: { type: PaymentType; status: PaymentStatus }[]
) => {
  const deposit = payments.find((row) => row.type === PaymentType.DEPOSIT);
  const balance = payments.find((row) => row.type === PaymentType.BALANCE);

  if (type === PaymentType.DEPOSIT) {
    return estimate.status === EstimateStatus.ACCEPTED && !isPaid(deposit);
  }
  return (
    isPaid(deposit) &&
    estimate.estimateRequest.status === EstimateRequestStatus.COMPLETED &&
    !isPaid(balance)
  );
};

// 고객 본인의 견적인지 확인한다
const assertOwnedByCustomer = (
  estimate: Pick<EstimateForPayment, 'estimateRequest'>,
  userId: string,
  role: Role
) => {
  if (role !== Role.CUSTOMER) {
    throw new ForbiddenError('고객만 결제할 수 있습니다.');
  }
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
      orderName: `${estimate.mover.user.name} 기사님 이사 ${
        type === PaymentType.DEPOSIT ? '선수금' : '잔금'
      }`,
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

    const payments = await paymentRepository.findByEstimateId(
      payment.estimateId
    );
    if (!canPay(payment.type, payment.estimate, payments)) {
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

/** 토스 승인 호출. 4xx 거절은 FAILED 로 기록하고 사유를 에러 메시지로 돌려준다 */
const approveWithToss = async (paymentId: string, input: ConfirmPaymentDto) => {
  try {
    const result = await tossClient.confirm(input);
    if (result.status !== TOSS_DONE || result.totalAmount !== input.amount) {
      throw new ServiceUnavailableError(
        '결제 승인 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }
    return result;
  } catch (error) {
    if (!(error instanceof TossApiError)) throw error;

    // 이미 승인된 결제를 다시 확인하는 경우: 토스에서 상태를 조회해 이어서 처리한다
    if (error.code === 'ALREADY_PROCESSED_PAYMENT') {
      const existing = await tossClient.getPayment(input.paymentKey);
      if (
        existing.status === TOSS_DONE &&
        existing.orderId === input.orderId &&
        existing.totalAmount === input.amount
      ) {
        return existing;
      }
    }

    if (error.status >= 500) {
      throw new ServiceUnavailableError(
        '결제 승인 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
      );
    }

    const message = `결제 승인에 실패했습니다. ${error.message} (${error.code})`;
    await paymentRepository.markFailed(paymentId, message);
    throw new BadRequestError(message);
  }
};
