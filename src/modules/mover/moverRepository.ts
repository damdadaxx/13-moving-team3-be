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

/*
@ FindManyParams

- 기사님 목록 조회 Repository에 전달되는 조건입니다.
- cursor/size 방식을 사용합니다.
*/
interface FindManyParams {
  keyword?: string;
  region?: Region;
  serviceType?: ServiceType;
  sortBy: MoverSortBy;
  cursor?: string;
  size: number;
}

/*
@ MoverListRow

- 목록 조회 전용 Raw SQL이 반환하는 데이터 타입입니다.
- id와 userId에는 같은 MoverProfile.userId 값이 들어갑니다.
- id는 공용 paginateByCursor 유틸에서 사용합니다.
- userId는 기존 moverMapper.toListItem에서 사용합니다.
- COUNT는 SQL에서 integer로 변환해 JavaScript number로 받습니다.
- 평균 평점은 double precision으로 변환해 number로 받습니다.
*/
interface MoverListRow {
  id: string;
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

/*
@ CountRow

- 기사님 목록 전체 개수를 조회하는 Raw SQL 결과 타입입니다.
- SQL에서 COUNT 값을 count라는 이름으로 반환하므로
  TypeScript에도 동일한 이름과 number 타입을 선언합니다.
*/
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
@ MoverSortColumns

- 현재 조회할 기사님 rows와 커서 기사님 cursor_row의
  정렬값 컬럼을 한 쌍으로 관리합니다.
*/
interface MoverSortColumns {
  row: Prisma.Sql;
  cursor: Prisma.Sql;
}

/*
@ LIST_SORT_COLUMNS

- 커서 다음에 있는 기사님을 찾을 때 사용할 정렬 컬럼입니다.
- 현재 기사님의 값과 커서 기사님의 값을 비교합니다.
*/
const LIST_SORT_COLUMNS: Record<MoverSortBy, MoverSortColumns> = {
  reviewCount: {
    row: Prisma.sql`rows."reviewCount"`,
    cursor: Prisma.sql`cursor_row."reviewCount"`,
  },
  rating: {
    row: Prisma.sql`rows."averageRating"`,
    cursor: Prisma.sql`cursor_row."averageRating"`,
  },
  career: {
    row: Prisma.sql`rows."careerMonths"`,
    cursor: Prisma.sql`cursor_row."careerMonths"`,
  },
  confirmedCount: {
    row: Prisma.sql`rows."confirmedCount"`,
    cursor: Prisma.sql`cursor_row."confirmedCount"`,
  },
};

/*
@ LIST_ORDER_BY

- 클라이언트가 전달한 정렬값을 미리 정한 SQL 조각에 연결합니다.
- 모든 정렬은 높은 값부터 보여주기 위해 내림차순으로 적용합니다.
- 정렬값이 같은 기사님은 고유한 id 내림차순으로 다시 정렬합니다.
*/
const LIST_ORDER_BY: Record<MoverSortBy, Prisma.Sql> = {
  reviewCount: Prisma.sql`rows."reviewCount" DESC`,
  rating: Prisma.sql`rows."averageRating" DESC`,
  career: Prisma.sql`rows."careerMonths" DESC`,
  confirmedCount: Prisma.sql`rows."confirmedCount" DESC`,
};

/*
@ buildCursorClause

- 첫 번째 페이지처럼 cursor가 없으면 커서 조건을 추가하지 않습니다.
- cursor가 있으면 해당 기사님의 정렬값과 id를 기준으로
  그다음에 위치한 기사님만 조회합니다.

@ 동작 예시

- 리뷰 수가 커서 기사님보다 적은 기사님을 조회합니다.
- 리뷰 수가 같다면 id가 커서 기사님보다 작은 기사님을 조회합니다.
- 정렬값이 같을 때 id를 함께 비교해야 순서가 흔들리지 않습니다.

@ 주의사항

- 모든 정렬이 내림차순이므로 다음 데이터를 찾을 때 `<`를 사용합니다.
- cursor는 moverValidation에서 UUID 형식 검증을 마친 값입니다.
*/
const buildCursorClause = (
  cursor: string | undefined,
  sortBy: MoverSortBy
): Prisma.Sql => {
  if (!cursor) {
    return Prisma.empty;
  }

  const sortColumns = LIST_SORT_COLUMNS[sortBy];

  return Prisma.sql`
    INNER JOIN "moverRows" AS cursor_row
      ON cursor_row."id" = CAST(${cursor} AS uuid)
    WHERE (
      ${sortColumns.row} < ${sortColumns.cursor}
      OR (
        ${sortColumns.row} = ${sortColumns.cursor}
        AND rows."id" < cursor_row."id"
      )
    )
  `;
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

- 별명 검색, 지역·서비스 필터, 정렬, 커서 페이지네이션을 적용합니다.
- 카드에 필요한 리뷰·확정 견적·찜 수를 각각 집계합니다.
- 확정 횟수는 EstimateStatus.ACCEPTED인 견적 수입니다.
- 다음 페이지가 있는지 확인하기 위해 size보다 한 건 더 조회합니다.

@ Raw SQL 사용 이유

- 평균 평점과 조건부 확정 횟수로 전체 결과를 정렬한 다음
  페이지네이션해야 합니다.
- Prisma의 일반 findMany만으로는 관계 평균과 조건부 count를
  동시에 정렬하기 어려워 이 목록 쿼리에만 parameterized SQL을 사용합니다.

@ 커서 처리

- cursor에는 직전 페이지의 마지막 기사님 ID가 들어옵니다.
- CTE에서 모든 기사님의 집계값을 먼저 계산합니다.
- 이후 커서 기사님의 정렬값과 ID를 함께 비교하여 다음 데이터를 찾습니다.
*/
  findMany: async ({
    keyword,
    region,
    serviceType,
    sortBy,
    cursor,
    size,
  }: FindManyParams): Promise<MoverListRow[]> => {
    const where = buildListWhere({ keyword, region, serviceType });
    const orderBy = LIST_ORDER_BY[sortBy];
    const cursorClause = buildCursorClause(cursor, sortBy);

    return prisma.$queryRaw<MoverListRow[]>`
    WITH "moverRows" AS (
      SELECT
        /*
        공용 paginateByCursor는 id 필드를 사용합니다.
        실제 값은 MoverProfile의 기본키인 userId와 같습니다.
        */
        mover."userId" AS "id",
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
    )

    SELECT rows.*
    FROM "moverRows" AS rows
    ${cursorClause}
    ORDER BY ${orderBy}, rows."id" DESC

    /*
    다음 페이지 존재 여부를 확인하기 위해
    요청받은 size보다 한 건 더 조회합니다.
    */
    LIMIT ${size + 1}
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
