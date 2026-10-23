import { Prisma } from '../../generated/prisma/client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import { deleteCacheByPrefix } from '../../lib/redis';
import { estimateRepository } from '../estimate/estimateRepository';
import moverRepository from '../mover/moverRepository';
import reviewRepository from './reviewRepository';
import {
  CreateDraftReviewInput,
  CreateReviewInput,
  GetMoverReviewsData,
  GetMyReviewsData,
} from './reviewTypes';
import { draftResultSchema, draftSchema } from './reviewSchema';
import { generateJson } from '../../lib/gemini';
import { buildDraftPrompt } from './reviewDraftPrompt';

function getReviewOrderBy(
  hasReview: boolean | undefined,
  sort: 'reviewDate' | 'moveDate' | undefined
): Prisma.EstimateOrderByWithRelationInput[] {
  // 정렬을 지정하지 않으면 Postgres 가 순서를 보장하지 않아
  // 페이지를 넘길 때 같은 행이 다시 나오거나 누락된다.
  // createdAt 이 같은 행이 있어도 흔들리지 않도록 id 를 tie-break 로 둔다.

  //리뷰를 아직 작성하지 않은 목록
  if (!hasReview) return [{ createdAt: 'desc' }, { id: 'desc' }];
  //리뷰를 작성한 목록
  return sort === 'moveDate'
    ? [{ estimateRequest: { moveDate: 'desc' } }, { id: 'desc' }] // 이사일순
    : [{ review: { createdAt: 'desc' } }, { id: 'desc' }]; // 리뷰 작성순
}

const reviewService = {
  getMyReviews: async ({
    userId,
    page,
    pageSize,
    hasReview,
    sort,
  }: GetMyReviewsData) => {
    //hasReview에 따라 리뷰할수있는 견적서를 가져올지 리뷰를 완료한 견적서를 가져올지 정한다.
    //실제로 계약한 견적(ACCEPTED)만 리뷰 대상이다. 같은 요청에 달렸어도
    //탈락(NOT_SELECTED)·반려(REJECTED)·응답 전(DESIGNATED) 견적은 제외한다.
    const where: Prisma.EstimateWhereInput = {
      status: 'ACCEPTED',
      estimateRequest: {
        customerId: userId,
        status: 'COMPLETED',
      },
      review: hasReview ? { isNot: null } : { is: null },
    };

    const orderBy: Prisma.EstimateOrderByWithRelationInput[] = getReviewOrderBy(
      hasReview,
      sort
    );

    const { estimates, estimateCount } =
      await reviewRepository.getFindReviewEstimates(
        where,
        page,
        pageSize,
        orderBy
      );

    //페이지 수 계산을 위해 전체에서 나눈후 올림한다.
    const totalPages = Math.ceil(estimateCount / pageSize);

    return { list: estimates, totalPages };
  },
  getMoverReviews: async ({ moverId, page, pageSize }: GetMoverReviewsData) => {
    const where: Prisma.ReviewWhereInput = { moverId };
    const mover = await moverRepository.findByUserId(moverId);
    if (!mover) {
      throw new NotFoundError('기사님을 찾을 수 없습니다.');
    }
    const [reviews, distribution, ratingInfo] = await Promise.all([
      reviewRepository.getMoverReviews({
        moverId,
        page,
        pageSize,
      }),
      reviewRepository.getRatingDistribution(moverId),
      reviewRepository.getRatingInfo(moverId, where),
    ]);

    const ratingDistribution = distribution.map((data) => {
      return { rating: data.rating, count: data._count.rating };
    });

    const reviewCount = ratingInfo[0]?._count.rating ?? 0;
    const ratingAvg = Number((ratingInfo[0]?._avg.rating ?? 0).toFixed(1));

    const totalPages = Math.ceil(reviewCount / pageSize);
    return {
      list: reviews.map(({ customer, ...review }) => ({
        ...review,
        user: { name: customer.user.name },
      })),
      ratingDistribution,
      ratingAvg,
      reviewCount,
      totalPages,
    };
  },
  createReview: async (
    userId: string,
    { estimateId, content, rating }: CreateReviewInput
  ) => {
    const estimateInfo =
      await estimateRepository.findByIdWithDetail(estimateId);

    if (!estimateInfo) {
      throw new NotFoundError('견적 정보를 찾을 수 없습니다.');
    }
    //견적서의 주인 인지 확인한다.
    if (estimateInfo.estimateRequest.customerId !== userId)
      throw new ForbiddenError('리뷰 작성 권한이 없는 견적서입니다.');

    //실제로 계약한 견적인지 검증하기.
    //이 검증이 없으면 같은 요청에 달린 탈락·반려 견적에도 리뷰를 쓸 수 있어
    //계약하지 않은 기사님의 평점을 조작할 수 있다.
    if (estimateInfo.status !== 'ACCEPTED')
      throw new BadRequestError('확정한 견적서만 리뷰를 할 수 있습니다.');

    //이사 완료 상태인지 검증하기.
    if (estimateInfo.estimateRequest.status !== 'COMPLETED')
      throw new BadRequestError(
        '완료된 상태의 견적서만 리뷰를 할 수 있습니다.'
      );

    //리뷰가 작성된 적 있는지 검증하기.
    if (estimateInfo.review != null)
      throw new BadRequestError('이미 작성된 리뷰가 있는 견적서 입니다.');

    const review = await reviewRepository.createReview(userId, {
      moverId: estimateInfo.moverId,
      estimateId,
      content,
      rating,
    });

    // 기사님 평점 평균·리뷰 수가 바뀌므로 기사님 조회 캐시 삭제
    await deleteCacheByPrefix('cache:/mover');

    return review;
  },
  createDraftReview: async (
    userId: string,
    { estimateId, rating, locale }: CreateDraftReviewInput
  ) => {
    //견적서 정보 조회
    const estimateInfo =
      await estimateRepository.findByIdWithDetail(estimateId);
    if (!estimateInfo) {
      throw new NotFoundError('견적 정보를 찾을 수 없습니다.');
    }

    //리뷰를 쓸 수 있는 견적서인지 createReview 와 같은 기준으로 확인한다.
    //이 검증이 없으면 로그인한 누구나 남의 견적서 ID로 초안을 만들어
    //Gemini 사용량을 쓰고 기사님 별명·이사일을 알아낼 수 있다.
    if (estimateInfo.estimateRequest.customerId !== userId)
      throw new ForbiddenError('리뷰 작성 권한이 없는 견적서입니다.');
    if (estimateInfo.status !== 'ACCEPTED')
      throw new BadRequestError('확정한 견적서만 리뷰를 할 수 있습니다.');
    if (estimateInfo.estimateRequest.status !== 'COMPLETED')
      throw new BadRequestError(
        '완료된 상태의 견적서만 리뷰를 할 수 있습니다.'
      );
    if (estimateInfo.review != null)
      throw new BadRequestError('이미 작성된 리뷰가 있는 견적서 입니다.');

    const prompt = buildDraftPrompt({
      locale,
      rating,
      nickname: estimateInfo.mover.nickname,
      moveDate: estimateInfo.estimateRequest.moveDate,
    });

    //타임아웃·Gemini 오류는 generateJson 이 503 으로 바꿔 던진다.
    const output = await generateJson({ prompt, schema: draftSchema });

    const draft = draftResultSchema.safeParse(output);
    if (!draft.success) {
      throw new BadRequestError('리뷰 초안을 생성하지 못했습니다.');
    }
    return draft.data;
  },
};
export default reviewService;
