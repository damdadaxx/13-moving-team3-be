import {
  EstimateStatus,
  Prisma,
  Role,
} from '../../src/generated/prisma/client';
import { estimateService } from '../../src/modules/estimate/estimateService';
import { estimateRequestRepository } from '../../src/modules/estimate/estimateRequestRepository';
import { estimateRepository } from '../../src/modules/estimate/estimateRepository';
import notificationService from '../../src/modules/notification/notificationService';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/error';

// DB 를 쓰는 모듈은 전부 mock 으로 바꾼다. 서비스의 분기·에러 변환 로직만 검증한다.
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((run: (tx: object) => unknown) => run({})),
  },
}));
jest.mock('../../src/modules/estimate/estimateRequestRepository');
jest.mock('../../src/modules/estimate/estimateRepository');
jest.mock('../../src/modules/notification/notificationService');

const findById = jest.mocked(estimateRequestRepository.findById);
const createGeneral = jest.mocked(estimateRepository.createGeneral);
const createNotification = jest.mocked(notificationService.create);
const publishCreated = jest.mocked(notificationService.publishCreated);

const DAY = 24 * 60 * 60 * 1000;
const INPUT = {
  estimateRequestId: 'request-1',
  price: 100000,
  comment: '깨끗하게 옮겨 드리겠습니다.',
};
const pendingRequest = (overrides = {}) =>
  ({
    id: 'request-1',
    status: 'PENDING',
    moveDate: new Date(Date.now() + DAY),
    customerId: 'customer-1',
    serviceType: 'SMALL_MOVE',
    ...overrides,
  }) as Awaited<ReturnType<typeof estimateRequestRepository.findById>>;

describe('estimateService.createEstimate (일반 견적 보내기)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('기사님이 아니면 403', async () => {
    await expect(
      estimateService.createEstimate('user-1', Role.CUSTOMER, INPUT)
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(findById).not.toHaveBeenCalled();
  });

  test('견적 요청이 없으면 404', async () => {
    findById.mockResolvedValue(null);

    await expect(
      estimateService.createEstimate('mover-1', Role.MOVER, INPUT)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test.each([
    ['확정된 요청', { status: 'CONFIRMED' }],
    ['이사일이 지난 요청', { moveDate: new Date(Date.now() - DAY) }],
  ])('%s 이면 409 이고 견적을 만들지 않는다', async (_label, overrides) => {
    findById.mockResolvedValue(pendingRequest(overrides));

    await expect(
      estimateService.createEstimate('mover-1', Role.MOVER, INPUT)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(createGeneral).not.toHaveBeenCalled();
  });

  test('성공하면 견적을 만들고 고객에게 새 견적 알림을 보낸다', async () => {
    findById.mockResolvedValue(pendingRequest());
    createGeneral.mockResolvedValue({
      id: 'estimate-1',
      estimateRequestId: 'request-1',
      price: INPUT.price,
      comment: INPUT.comment,
      isDesignated: false,
      status: 'PROPOSED',
      mover: { user: { name: '김기사' } },
    } as Awaited<ReturnType<typeof estimateRepository.createGeneral>>);
    createNotification.mockResolvedValue({ id: 'noti-1' } as Awaited<
      ReturnType<typeof notificationService.create>
    >);

    const result = await estimateService.createEstimate(
      'mover-1',
      Role.MOVER,
      INPUT
    );

    expect(result).toMatchObject({
      estimateId: 'estimate-1',
      status: 'PROPOSED',
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
        type: 'NEW_ESTIMATE',
        targetPath: 'estimate-1',
      }),
      expect.anything()
    );
    expect(publishCreated).toHaveBeenCalledWith([{ id: 'noti-1' }]);
  });

  test('같은 요청에 이미 보낸 견적이 있으면(P2002) 409 로 바꿔 던진다', async () => {
    findById.mockResolvedValue(pendingRequest());
    createGeneral.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    await expect(
      estimateService.createEstimate('mover-1', Role.MOVER, INPUT)
    ).rejects.toThrow('이미 해당 요청에 견적을 보냈습니다.');
    expect(publishCreated).not.toHaveBeenCalled();
  });
});

const findByIdWithDetail = jest.mocked(estimateRepository.findByIdWithDetail);
const updateEstimate = jest.mocked(estimateRepository.update);

const designatedEstimate = () =>
  ({
    id: 'estimate-1',
    moverId: 'mover-1',
    estimateRequestId: 'request-1',
    status: EstimateStatus.DESIGNATED,
    mover: { user: { name: '김기사' } },
    estimateRequest: {
      customerId: 'customer-1',
      status: 'PENDING',
      moveDate: new Date(Date.now() + DAY),
      serviceType: 'SMALL_MOVE',
      customer: { user: { name: '고객' } },
    },
  }) as Awaited<ReturnType<typeof estimateRepository.findByIdWithDetail>>;

describe('estimateService.updateEstimateStatus (지정 견적 반려)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('기사님이 반려하면 고객에게 ESTIMATE_REJECTED 알림을 보낸다', async () => {
    findByIdWithDetail.mockResolvedValue(designatedEstimate());
    updateEstimate.mockResolvedValue(
      {} as Awaited<ReturnType<typeof estimateRepository.update>>
    );
    createNotification.mockResolvedValue({ id: 'noti-reject' } as Awaited<
      ReturnType<typeof notificationService.create>
    >);

    const result = await estimateService.updateEstimateStatus(
      'mover-1',
      Role.MOVER,
      'estimate-1',
      {
        status: 'REJECTED',
        rejectReason: '해당 날짜에 이미 확정된 이사 일정이 있어 어렵습니다.',
      }
    );

    expect(result).toMatchObject({
      estimateId: 'estimate-1',
      status: 'REJECTED',
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
        type: 'ESTIMATE_REJECTED',
      }),
      expect.anything()
    );
    expect(createNotification.mock.calls[0][0]).not.toHaveProperty(
      'targetPath'
    );
    expect(publishCreated).toHaveBeenCalledWith([{ id: 'noti-reject' }]);
  });
});
