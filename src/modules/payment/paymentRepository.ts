import { prisma } from '../../lib/prisma';
import {
  Prisma,
  PaymentStatus,
  PaymentType,
} from '../../generated/prisma/client';
import { buildCursorArgs } from '../../utils/cursorPagination';

// 결제 가능 여부와 주문 정보에 필요한 견적·요청 정보만 가져온다
const estimateForPaymentSelect = {
  id: true,
  status: true,
  price: true,
  mover: { select: { user: { select: { name: true } } } },
  estimateRequest: {
    select: {
      customerId: true,
      status: true,
      customer: { select: { user: { select: { name: true } } } },
    },
  },
} as const;

// 결제내역 목록에 보여줄 견적·기사님 정보
const historyEstimateSelect = {
  id: true,
  price: true,
  mover: {
    select: { userId: true, nickname: true, user: { select: { name: true } } },
  },
  estimateRequest: {
    select: {
      serviceType: true,
      moveDate: true,
      departureAddress: true,
      arrivalAddress: true,
    },
  },
} as const;

export type HistoryStatus = PaymentStatus | 'ALL';

const historyWhere = (
  customerId: string,
  status: HistoryStatus
): Prisma.PaymentWhereInput => ({
  estimate: { estimateRequest: { customerId } },
  ...(status === 'ALL' ? {} : { status }),
});

export const paymentRepository = {
  findEstimateForPayment: (estimateId: string) => {
    return prisma.estimate.findUnique({
      where: { id: estimateId },
      select: estimateForPaymentSelect,
    });
  },

  findByEstimateId: (estimateId: string) => {
    return prisma.payment.findMany({ where: { estimateId } });
  },

  findByOrderId: (orderId: string) => {
    return prisma.payment.findUnique({
      where: { orderId },
      include: { estimate: { select: estimateForPaymentSelect } },
    });
  },

  // 같은 (견적, 종류) 주문이 동시에 들어와도 한 행만 만든다
  createOrGet: (data: {
    estimateId: string;
    type: PaymentType;
    orderId: string;
    amount: number;
  }) => {
    return prisma.payment.upsert({
      where: {
        estimateId_type: { estimateId: data.estimateId, type: data.type },
      },
      create: data,
      update: {},
    });
  },

  // 결제가 거절된 주문을 새 주문번호로 다시 연다
  resetForRetry: (id: string, orderId: string) => {
    return prisma.payment.update({
      where: { id },
      data: { orderId, status: PaymentStatus.READY, failureMessage: null },
    });
  },

  // 승인 대기 중인 결제의 결제 키를 남겨 둔다. 키가 있는 READY 는 다시 결제할 수 없다
  savePaymentKey: (id: string, paymentKey: string) => {
    return prisma.payment.updateMany({
      where: { id, status: PaymentStatus.READY },
      data: { paymentKey },
    });
  },

  markFailed: (id: string, failureMessage: string) => {
    return prisma.payment.updateMany({
      where: { id, status: { not: PaymentStatus.PAID } },
      data: { status: PaymentStatus.FAILED, failureMessage },
    });
  },

  // 이미 PAID 인 행은 건드리지 않는다 (같은 승인 요청이 겹쳐도 한 번만 반영)
  markPaid: async (id: string, paymentKey: string, paidAt: Date) => {
    await prisma.payment.updateMany({
      where: { id, status: { not: PaymentStatus.PAID } },
      data: {
        status: PaymentStatus.PAID,
        paymentKey,
        paidAt,
        failureMessage: null,
      },
    });
    return prisma.payment.findUniqueOrThrow({ where: { id } });
  },

  // 결제내역: 고객 본인의 결제, 결제 완료 시각 최신순 (시각이 없는 건은 뒤로)
  findHistory: (
    customerId: string,
    {
      status,
      cursor,
      size,
    }: { status: HistoryStatus; cursor?: string; size: number }
  ) => {
    return prisma.payment.findMany({
      where: historyWhere(customerId, status),
      ...buildCursorArgs(cursor, size),
      orderBy: [
        { paidAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: { estimate: { select: historyEstimateSelect } },
    });
  },

  countHistory: (customerId: string, status: HistoryStatus) => {
    return prisma.payment.count({ where: historyWhere(customerId, status) });
  },
};
