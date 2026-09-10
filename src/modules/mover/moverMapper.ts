import moverRepository from './moverRepository';

type MoverProfileWithRelations = NonNullable<
  Awaited<ReturnType<typeof moverRepository.findByUserId>>
>;

type MoverListRow = Awaited<
  ReturnType<typeof moverRepository.findMany>
>[number];

type MoverDetailWithStats = NonNullable<
  Awaited<ReturnType<typeof moverRepository.findByIdWithStats>>
>;

/*
@ roundRating

- 평균 평점을 소수점 첫째 자리까지 반환합니다.
- 예: 4.666... → 4.7
*/
const roundRating = (rating: number): number => {
  return Math.round(rating * 10) / 10;
};

/*=================================================
기사님 응답 변환 Mapper
=================================================*/

/*
@ Mapper를 분리하는 이유

- Repository는 DB 조회 형태를 반환합니다.
- Controller는 HTTP 요청과 응답만 처리합니다.
- Mapper는 DB 결과를 프론트에서 사용하기 좋은 API 형태로 바꿉니다.
*/
const moverMapper = {
  /*
  @ toProfile

  - 본인 프로필 등록·조회·수정 응답에 공통으로 사용합니다.
  - 관계 객체 배열을 enum 문자열 배열로 변환합니다.
  */
  toProfile: (profile: MoverProfileWithRelations) => {
    return {
      id: profile.userId,
      imgUrl: profile.imgUrl,
      nickname: profile.nickname,
      careerMonths: profile.careerMonths,
      shortIntro: profile.shortIntro,
      description: profile.description,
      serviceTypes: profile.serviceTypes.map(({ serviceType }) => serviceType),
      serviceRegions: profile.serviceRegions.map(({ region }) => region),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },

  /*
  @ toListItem

  - 기사님 찾기 목록의 카드 한 개에 필요한 형태로 변환합니다.
  - 목록 SQL에서 계산한 집계값을 그대로 사용합니다.
  */
  toListItem: (mover: MoverListRow) => {
    return {
      id: mover.userId,
      imgUrl: mover.imgUrl,
      nickname: mover.nickname,
      careerMonths: mover.careerMonths,
      shortIntro: mover.shortIntro,
      serviceTypes: mover.serviceTypes,
      serviceRegions: mover.serviceRegions,
      averageRating: roundRating(mover.averageRating),
      reviewCount: mover.reviewCount,
      confirmedCount: mover.confirmedCount,
      likeCount: mover.likeCount,
    };
  },

  /*
  @ toDetail

  - 공개 기사님 상세 페이지에 필요한 프로필과 집계값을 반환합니다.
  - 리뷰 본문과 평점 분포는 Review API가 담당하므로 포함하지 않습니다.
  */
  toDetail: (profile: MoverDetailWithStats) => {
    const reviewCount = profile.reviews.length;
    const ratingSum = profile.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    const averageRating =
      reviewCount === 0 ? 0 : roundRating(ratingSum / reviewCount);

    return {
      id: profile.userId,
      imgUrl: profile.imgUrl,
      nickname: profile.nickname,
      careerMonths: profile.careerMonths,
      shortIntro: profile.shortIntro,
      description: profile.description,
      serviceTypes: profile.serviceTypes.map(({ serviceType }) => serviceType),
      serviceRegions: profile.serviceRegions.map(({ region }) => region),
      averageRating,
      reviewCount,
      confirmedCount: profile.estimates.length,
      likeCount: profile.likedBy.length,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
};

export default moverMapper;
