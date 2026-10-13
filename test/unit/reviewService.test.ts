import reviewService from '../../src/modules/review/reviewService';
import reviewRepository from '../../src/modules/review/reviewRepository';
import { estimateRepository } from '../../src/modules/estimate/estimateRepository';
import { deleteCacheByPrefix } from '../../src/lib/redis';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/error';

jest.mock('../../src/modules/review/reviewRepository');
jest.mock('../../src/modules/estimate/estimateRepository');
jest.mock('../../src/modules/mover/moverRepository');
jest.mock('../../src/lib/redis');

const findEstimate = jest.mocked(estimateRepository.findByIdWithDetail);
const createReview = jest.mocked(reviewRepository.createReview);

type EstimateDetail = Awaited<
  ReturnType<typeof estimateRepository.findByIdWithDetail>
>;
const estimate = ({
  status = 'ACCEPTED',
  requestStatus = 'COMPLETED',
  customerId = 'customer-1',
  review = null as object | null,
} = {}) =>
  ({
    id: 'estimate-1',
    moverId: 'mover-1',
    status,
    review,
    estimateRequest: { customerId, status: requestStatus },
  }) as unknown as EstimateDetail;

const INPUT = {
  estimateId: 'estimate-1',
  content: '친절하게 옮겨 주셨어요.',
  rating: 5,
};

describe('reviewService.createReview', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['견적이 없으면 404', null, NotFoundError],
    [
      '남의 견적이면 403',
      estimate({ customerId: 'someone-else' }),
      ForbiddenError,
    ],
    [
      '확정하지 않은 견적이면 400',
      estimate({ status: 'NOT_SELECTED' }),
      BadRequestError,
    ],
    [
      '이사가 끝나지 않았으면 400',
      estimate({ requestStatus: 'CONFIRMED' }),
      BadRequestError,
    ],
    [
      '이미 리뷰가 있으면 400',
      estimate({ review: { id: 'review-1' } }),
      BadRequestError,
    ],
  ])('%s', async (_label, found, ErrorType) => {
    findEstimate.mockResolvedValue(found);

    await expect(
      reviewService.createReview('customer-1', INPUT)
    ).rejects.toBeInstanceOf(ErrorType);
    expect(createReview).not.toHaveBeenCalled();
  });

  test('조건을 모두 만족하면 견적의 기사님으로 리뷰를 만들고 기사님 캐시를 지운다', async () => {
    findEstimate.mockResolvedValue(estimate());
    createReview.mockResolvedValue({ id: 'review-1' } as Awaited<
      ReturnType<typeof reviewRepository.createReview>
    >);

    await reviewService.createReview('customer-1', INPUT);

    expect(createReview).toHaveBeenCalledWith('customer-1', {
      moverId: 'mover-1',
      estimateId: 'estimate-1',
      content: INPUT.content,
      rating: 5,
    });
    expect(deleteCacheByPrefix).toHaveBeenCalledWith('cache:/mover');
  });
});
