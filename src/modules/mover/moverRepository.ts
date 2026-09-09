import {
  EstimateStatus,
  Prisma,
  Region,
  ServiceType,
} from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';

/*=================================================
기사님 프로필 공통 관계 조회 설정
=================================================*/

/*
@ MOVER_PROFILE_RELATIONS

- 기사님 프로필과 제공 서비스, 서비스 가능 지역을 함께 조회합니다.
- 등록, 본인 조회, 수정 응답에서 같은 관계 구조를 재사용합니다.
*/
const MOVER_PROFILE_RELATIONS = {
  serviceTypes: {
    orderBy: {
      serviceType: 'asc' as const,
    },
    select: {
      serviceType: true,
    },
  },
  serviceRegions: {
    orderBy: {
      region: 'asc' as const,
    },
    select: {
      region: true,
    },
  },
} as const;

type MoverSortBy = 'reviewCount' | 'rating' | 'career' | 'confirmedCount';

interface CreateMoverProfileData {
  userId: string;
  imgUrl: string | null;
  nickname: string;
  careerMonths: number;
  shortIntro: string;
  description: string;
  serviceTypes: ServiceType[];
  serviceRegions: Region[];
}

interface UpdateMoverProfileData {
  imgUrl?: string | null;
  nickname?: string;
  careerMonths?: number;
  shortIntro?: string;
  description?: string;
  serviceTypes?: ServiceType[];
  serviceRegions?: Region[];
}

interface FindManyParams {
  keyword?: string;
  region?: Region;
  serviceType?: ServiceType;
  sortBy: MoverSortBy;
  page: number;
  pageSize: number;
}

/*
@ MoverListRow

- 목록 조회 전용 SQL이 반환하는 데이터 타입입니다.
- COUNT는 SQL에서 integer로 변환해 JavaScript number로 받습니다.
- 평균 평점은 double precision으로 변환해 number로 받습니다.
*/
interface MoverListRow {
  userId: string;
  imgUrl: string | null;
  nickname: string;
  careerMonths: number;
  shortIntro: string;
  serviceTypes: ServiceType[];
  serviceRegions: Region[];
  averageRating: number;
  reviewCount: number;
  confirmedCount: number;
  likeCount: number;
}

interface CountRow {
  count: number;
}

/*
@ buildListWhere

- 목록 검색과 필터 조건을 안전한 parameterized SQL로 만듭니다.
- 사용자 입력을 SQL 문자열에 직접 이어 붙이지 않으므로
  SQL injection 위험을 방지할 수 있습니다.
*/
const buildListWhere = ({
  keyword,
  region,
  serviceType,
}: Pick<FindManyParams, 'keyword' | 'region' | 'serviceType'>): Prisma.Sql => {
  const conditions: Prisma.Sql[] = [];

  if (keyword) {
    conditions.push(Prisma.sql`mover."nickname" ILIKE ${`%${keyword}%`}`);
  }

  if (region) {
    conditions.push(
      Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "moverServiceRegion" AS service_region
          WHERE service_region."moverId" = mover."userId"
            AND service_region."region" = CAST(${region} AS "Region")
        )
      `
    );
  }

  if (serviceType) {
    conditions.push(
      Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "moverServiceType" AS mover_service
          WHERE mover_service."moverId" = mover."userId"
            AND mover_service."serviceType" =
              CAST(${serviceType} AS "ServiceType")
        )
      `
    );
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
};

/*
@ LIST_ORDER_BY

- 클라이언트가 전달한 정렬값을 미리 정한 SQL 조각에 연결합니다.
- 임의의 문자열을 ORDER BY에 넣지 않아 안전하게 정렬할 수 있습니다.
- 동일한 값이 여러 개면 최종적으로 userId 내림차순을 적용합니다.
*/
const LIST_ORDER_BY: Record<MoverSortBy, Prisma.Sql> = {
  reviewCount: Prisma.sql`"reviewCount" DESC`,
  rating: Prisma.sql`"averageRating" DESC`,
  career: Prisma.sql`mover."careerMonths" DESC`,
  confirmedCount: Prisma.sql`"confirmedCount" DESC`,
};

/*=================================================
기사님 Repository
=================================================*/

const moverRepository = {
  /*
  @ findByUserId

  - User ID로 기사님 프로필을 조회합니다.
  - 프로필이 없으면 null을 반환합니다.
  */
  findByUserId: (userId: string) => {
    return prisma.moverProfile.findUnique({
      where: {
        userId,
      },
      include: MOVER_PROFILE_RELATIONS,
    });
  },

  /*
  @ create

  - 기사님 프로필과 서비스, 지역 관계를 함께 생성합니다.
  - Prisma 중첩 create이므로 한 DB 작업으로 처리됩니다.
  */
  create: (data: CreateMoverProfileData) => {
    return prisma.moverProfile.create({
      data: {
        userId: data.userId,
        imgUrl: data.imgUrl,
        nickname: data.nickname,
        careerMonths: data.careerMonths,
        shortIntro: data.shortIntro,
        description: data.description,
        serviceTypes: {
          create: data.serviceTypes.map((serviceType) => ({
            serviceType,
          })),
        },
        serviceRegions: {
          create: data.serviceRegions.map((region) => ({
            region,
          })),
        },
      },
      include: MOVER_PROFILE_RELATIONS,
    });
  },

  /*
  @ update

  - undefined가 아닌 프로필 필드만 수정합니다.
  - 서비스 또는 지역 배열이 전달되면 기존 관계를 새 목록으로 교체합니다.
  - careerMonths의 0은 유효한 값이므로 undefined를 명시적으로 검사합니다.
  */
  update: (userId: string, data: UpdateMoverProfileData) => {
    return prisma.moverProfile.update({
      where: {
        userId,
      },
      data: {
        ...(data.imgUrl !== undefined ? { imgUrl: data.imgUrl } : {}),
        ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
        ...(data.careerMonths !== undefined
          ? { careerMonths: data.careerMonths }
          : {}),
        ...(data.shortIntro !== undefined
          ? { shortIntro: data.shortIntro }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.serviceTypes !== undefined
          ? {
              serviceTypes: {
                deleteMany: {},
                create: data.serviceTypes.map((serviceType) => ({
                  serviceType,
                })),
              },
            }
          : {}),
        ...(data.serviceRegions !== undefined
          ? {
              serviceRegions: {
                deleteMany: {},
                create: data.serviceRegions.map((region) => ({
                  region,
                })),
              },
            }
          : {}),
      },
      include: MOVER_PROFILE_RELATIONS,
    });
  },

  /*
  @ findMany

  - 별명 검색, 지역·서비스 필터, 정렬, 페이지네이션을 적용합니다.
  - 카드에 필요한 리뷰·확정 견적·찜 수를 각각 집계합니다.
  - 확정 횟수는 EstimateStatus.ACCEPTED인 견적 수입니다.

  @ Raw SQL 사용 이유
  - 평균 평점과 조건부 확정 횟수로 전체 결과를 정렬한 다음
    페이지네이션해야 합니다.
  - Prisma의 일반 findMany만으로는 관계 평균과 조건부 count를
    동시에 정렬하기 어려워 이 목록 쿼리에만 parameterized SQL을 사용합니다.
  */
  findMany: async ({
    keyword,
    region,
    serviceType,
    sortBy,
    page,
    pageSize,
  }: FindManyParams): Promise<MoverListRow[]> => {
    const where = buildListWhere({ keyword, region, serviceType });
    const orderBy = LIST_ORDER_BY[sortBy];
    const offset = (page - 1) * pageSize;

    return prisma.$queryRaw<MoverListRow[]>`
      SELECT
        mover."userId",
        mover."imgUrl",
        mover."nickname",
        mover."careerMonths",
        mover."shortIntro",
        ARRAY(
          SELECT mover_service."serviceType"::text
          FROM "moverServiceType" AS mover_service
          WHERE mover_service."moverId" = mover."userId"
          ORDER BY mover_service."serviceType"
        ) AS "serviceTypes",
        ARRAY(
          SELECT service_region."region"::text
          FROM "moverServiceRegion" AS service_region
          WHERE service_region."moverId" = mover."userId"
          ORDER BY service_region."region"
        ) AS "serviceRegions",
        COALESCE(
          (
            SELECT AVG(review."rating")
            FROM "review" AS review
            WHERE review."moverId" = mover."userId"
          ),
          0
        )::double precision AS "averageRating",
        (
          SELECT COUNT(*)::integer
          FROM "review" AS review
          WHERE review."moverId" = mover."userId"
        ) AS "reviewCount",
        (
          SELECT COUNT(*)::integer
          FROM "estimate" AS estimate
          WHERE estimate."moverId" = mover."userId"
            AND estimate."status" =
              CAST(${EstimateStatus.ACCEPTED} AS "EstimateStatus")
        ) AS "confirmedCount",
        (
          SELECT COUNT(*)::integer
          FROM "like" AS mover_like
          WHERE mover_like."moverId" = mover."userId"
        ) AS "likeCount"
      FROM "moverProfile" AS mover
      ${where}
      ORDER BY ${orderBy}, mover."userId" DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;
  },

  /*
  @ count

  - 검색과 필터 조건을 만족하는 기사님의 전체 수를 반환합니다.
  - 페이지에 데이터가 없는 경우에도 정확한 totalCount를 얻기 위해
    목록 조회와 별도의 count 쿼리로 실행합니다.
  */
  count: async ({
    keyword,
    region,
    serviceType,
  }: Pick<
    FindManyParams,
    'keyword' | 'region' | 'serviceType'
  >): Promise<number> => {
    const where = buildListWhere({ keyword, region, serviceType });

    const [result] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::integer AS "count"
      FROM "moverProfile" AS mover
      ${where}
    `;

    return result?.count ?? 0;
  },

  /*
  @ findByIdWithStats

  - 공개 상세 화면에 필요한 기사님 프로필과 집계 원본을 조회합니다.
  - 리뷰는 평점만, 찜과 확정 견적은 ID만 가져와 불필요한 데이터를 줄입니다.
  */
  findByIdWithStats: (id: string) => {
    return prisma.moverProfile.findUnique({
      where: {
        userId: id,
      },
      include: {
        ...MOVER_PROFILE_RELATIONS,
        reviews: {
          select: {
            rating: true,
          },
        },
        likedBy: {
          select: {
            id: true,
          },
        },
        estimates: {
          where: {
            status: EstimateStatus.ACCEPTED,
          },
          select: {
            id: true,
          },
        },
      },
    });
  },
};

export default moverRepository;
