import { Prisma } from '../../src/generated/prisma/client';
import { estimateRequestService } from '../../src/modules/estimate-request/estimateRequestService';
import { estimateRequestRepository } from '../../src/modules/estimate-request/estimateRequestRepository';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/error';

jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/modules/estimate-request/estimateRequestRepository');
jest.mock('../../src/modules/notification/notificationService');

const createEstimateRequest = jest.mocked(
  estimateRequestRepository.createEstimateRequest
);
const findActive = jest.mocked(
  estimateRequestRepository.findActiveByCustomerId
);

const DAY = 24 * 60 * 60 * 1000;
const INPUT = {
  serviceType: 'HOME_MOVE' as const,
  moveDate: new Date(Date.now() + 7 * DAY),
  departureZipCode: '04524',
  departureAddress: '서울특별시 중구 세종대로 110',
  arrivalZipCode: '06035',
  arrivalAddress: '서울특별시 강남구 가로수길 5',
};
type CreateInput = Parameters<typeof estimateRequestService.create>[1];
type ActiveRequest = Awaited<
  ReturnType<typeof estimateRequestRepository.findActiveByCustomerId>
>;

describe('estimateRequestService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    test('이사일이 오늘 이전이면 400 이고 저장하지 않는다', async () => {
      await expect(
        estimateRequestService.create('customer-1', {
          ...INPUT,
          moveDate: new Date(Date.now() - DAY),
        } as CreateInput)
      ).rejects.toBeInstanceOf(BadRequestError);
      expect(createEstimateRequest).not.toHaveBeenCalled();
    });

    test('진행 중인 요청이 있어 유니크 제약(P2002)에 걸리면 409', async () => {
      createEstimateRequest.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        })
      );

      await expect(
        estimateRequestService.create('customer-1', INPUT as CreateInput)
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('createDesignated', () => {
    test.each([
      ['진행 중인 요청이 없으면 404', null, NotFoundError],
      [
        '본인 요청이 아니면 403',
        { id: 'other-request', status: 'PENDING' },
        ForbiddenError,
      ],
      [
        '이미 확정된 요청이면 400',
        { id: 'request-1', status: 'CONFIRMED' },
        BadRequestError,
      ],
    ])('%s', async (_label, active, ErrorType) => {
      findActive.mockResolvedValue(active as ActiveRequest);

      await expect(
        estimateRequestService.createDesignated(
          'customer-1',
          'request-1',
          'mover-1'
        )
      ).rejects.toBeInstanceOf(ErrorType);
    });
  });
});
