/* eslint-disable no-console -- 시드 실행 로그는 콘솔로 출력합니다. */
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * 개발용 시드 스크립트
 * - 실행 시 아래 테이블을 전부 비우고 다시 채웁니다. (개발 DB 전용)
 * - 실행: npx dotenv -e .env.development -- npx tsx prisma/seed.ts
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('환경변수 DATABASE_URL이 설정되지 않았습니다.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

/** 오늘 기준 n일 뒤(음수면 n일 전) 날짜 */
const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * 시드 계정용 비밀번호 해시.
 * 인증 모듈이 구현되면 프로젝트에서 실제로 사용하는 해시 방식으로 교체해야 합니다.
 */
const hashPassword = (plain: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(plain, salt, 64).toString('hex')}`;
};

/** 시드로 생성되는 모든 로컬 계정의 공통 비밀번호 */
const SEED_PASSWORD = 'test1234!';

// ---------------------------------------------------------------------------
// 고정 ID — 데이터 간 참조를 위해 UUID를 하드코딩합니다.
// ---------------------------------------------------------------------------

const MOVER = {
  minjae: '10000000-0000-4000-8000-000000000001',
  seojun: '10000000-0000-4000-8000-000000000002',
  jihoon: '10000000-0000-4000-8000-000000000003',
  yuri: '10000000-0000-4000-8000-000000000004',
  haneul: '10000000-0000-4000-8000-000000000005',
} as const;

const CUSTOMER = {
  jimin: '20000000-0000-4000-8000-000000000001',
  sehun: '20000000-0000-4000-8000-000000000002',
  nayoung: '20000000-0000-4000-8000-000000000003',
  donghyuk: '20000000-0000-4000-8000-000000000004',
  gayoung: '20000000-0000-4000-8000-000000000005',
  jinwoo: '20000000-0000-4000-8000-000000000006',
} as const;

const REQUEST = {
  jiminActive: '30000000-0000-4000-8000-000000000001',
  sehunConfirmed: '30000000-0000-4000-8000-000000000002',
  nayoungDone: '30000000-0000-4000-8000-000000000003',
  donghyukDone: '30000000-0000-4000-8000-000000000004',
  gayoungExpired: '30000000-0000-4000-8000-000000000005',
  jiminDone: '30000000-0000-4000-8000-000000000006',
  jinwooActive: '30000000-0000-4000-8000-000000000007',
  gayoungDone: '30000000-0000-4000-8000-000000000008',
  sehunDone: '30000000-0000-4000-8000-000000000009',
  jiminDoneOld: '30000000-0000-4000-8000-000000000010',
} as const;

const ESTIMATE = {
  jiminMinjae: '40000000-0000-4000-8000-000000000001',
  jiminHaneul: '40000000-0000-4000-8000-000000000002',
  jiminSeojun: '40000000-0000-4000-8000-000000000003',
  jiminYuri: '40000000-0000-4000-8000-000000000004',
  sehunMinjae: '40000000-0000-4000-8000-000000000005',
  sehunYuri: '40000000-0000-4000-8000-000000000006',
  sehunHaneul: '40000000-0000-4000-8000-000000000007',
  nayoungHaneul: '40000000-0000-4000-8000-000000000008',
  nayoungSeojun: '40000000-0000-4000-8000-000000000009',
  donghyukJihoon: '40000000-0000-4000-8000-000000000010',
  gayoungSeojun: '40000000-0000-4000-8000-000000000011',
  gayoungHaneul: '40000000-0000-4000-8000-000000000012',
  jiminDoneMinjae: '40000000-0000-4000-8000-000000000013',
  jinwooMinjae: '40000000-0000-4000-8000-000000000014',
  jinwooHaneul: '40000000-0000-4000-8000-000000000015',
  gayoungDoneYuri: '40000000-0000-4000-8000-000000000016',
  sehunDoneHaneul: '40000000-0000-4000-8000-000000000017',
  sehunDoneMinjae: '40000000-0000-4000-8000-000000000018',
  jiminOldHaneul: '40000000-0000-4000-8000-000000000019',
} as const;

// ---------------------------------------------------------------------------
// 1. 초기화 — 자식 → 부모 순서로 삭제
// ---------------------------------------------------------------------------

async function clear() {
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.like.deleteMany();
  await prisma.estimate.deleteMany();
  // 활성 견적요청 FK를 먼저 끊어야 EstimateRequest를 삭제할 수 있습니다.
  await prisma.customerProfile.updateMany({
    data: { activeEstimateRequestId: null },
  });
  await prisma.estimateRequest.deleteMany();
  await prisma.customerServiceType.deleteMany();
  await prisma.moverServiceType.deleteMany();
  await prisma.moverServiceRegion.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.moverProfile.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// 2. 기사님 (MOVER)
// ---------------------------------------------------------------------------

const movers = [
  {
    id: MOVER.minjae,
    name: '김민재',
    email: 'kim.minjae@moving.kr',
    phoneNumber: '01023450001',
    nickname: '민재 이사센터',
    careerMonths: 98,
    shortIntro: '이사는 짐이 아니라 일상을 옮기는 일입니다.',
    description:
      '8년간 수도권에서 원룸·투룸 이사를 전문으로 해왔습니다. 포장부터 배치까지 직접 챙기고, 파손이 생기면 100% 보상해 드립니다.',
    imgUrl: 'https://picsum.photos/seed/mover-minjae/240/240',
    serviceTypes: ['SMALL_MOVE', 'HOME_MOVE'],
    serviceRegions: ['SEOUL', 'GYEONGGI'],
  },
  {
    id: MOVER.seojun,
    name: '이서준',
    email: 'lee.seojun@moving.kr',
    phoneNumber: '01023450002',
    nickname: '서준 종합이사',
    careerMonths: 146,
    shortIntro: '사무실 이사, 주말에도 업무 중단 없이 끝내드립니다.',
    description:
      '12년 경력의 사무실·가정이사 전문 팀입니다. 사전 실측 후 견적을 드리며, 서버와 집기류 이전 경험이 많습니다.',
    imgUrl: 'https://picsum.photos/seed/mover-seojun/240/240',
    serviceTypes: ['HOME_MOVE', 'OFFICE_MOVE'],
    serviceRegions: ['SEOUL', 'INCHEON'],
  },
  {
    id: MOVER.jihoon,
    name: '박지훈',
    email: 'park.jihoon@moving.kr',
    phoneNumber: '01023450003',
    nickname: '지훈 원룸이사',
    careerMonths: 41,
    shortIntro: '부산·경남 원룸 이사, 합리적인 가격으로 모십니다.',
    description:
      '1인 가구 이사를 가장 많이 다뤘습니다. 소형 이사 특성상 당일 예약도 가능하며, 사다리차 비용을 미리 안내드립니다.',
    imgUrl: 'https://picsum.photos/seed/mover-jihoon/240/240',
    serviceTypes: ['SMALL_MOVE'],
    serviceRegions: ['BUSAN', 'GYEONGNAM', 'ULSAN'],
  },
  {
    id: MOVER.yuri,
    name: '최유리',
    email: 'choi.yuri@moving.kr',
    phoneNumber: '01023450004',
    nickname: '유리 안심이사',
    careerMonths: 77,
    shortIntro: '여성 1인 가구, 어르신 이사도 안심하고 맡기세요.',
    description:
      '중부권 전역을 다니며 가정이사를 진행합니다. 여성 작업자가 포함된 팀이라 혼자 사시는 분들이 많이 찾아주십니다.',
    imgUrl: 'https://picsum.photos/seed/mover-yuri/240/240',
    serviceTypes: ['SMALL_MOVE', 'HOME_MOVE'],
    serviceRegions: ['GYEONGGI', 'CHUNGNAM', 'SEJONG', 'DAEJEON'],
  },
  {
    id: MOVER.haneul,
    name: '정하늘',
    email: 'jung.haneul@moving.kr',
    phoneNumber: '01023450005',
    nickname: '하늘 프리미엄무빙',
    careerMonths: 182,
    shortIntro: '15년, 3,000건. 숫자로 증명하는 이사입니다.',
    description:
      '수도권 전역에서 소형·가정·사무실 이사를 모두 진행합니다. 전 과정을 사진으로 기록해 드리고, 보관이사도 상담 가능합니다.',
    imgUrl: 'https://picsum.photos/seed/mover-haneul/240/240',
    serviceTypes: ['SMALL_MOVE', 'HOME_MOVE', 'OFFICE_MOVE'],
    serviceRegions: ['SEOUL', 'GYEONGGI', 'INCHEON'],
  },
] as const;

async function seedMovers() {
  for (const mover of movers) {
    await prisma.user.create({
      data: {
        id: mover.id,
        name: mover.name,
        email: mover.email,
        phoneNumber: mover.phoneNumber,
        password: hashPassword(SEED_PASSWORD),
        role: 'MOVER',
        provider: 'LOCAL',
        moverProfile: {
          create: {
            imgUrl: mover.imgUrl,
            nickname: mover.nickname,
            careerMonths: mover.careerMonths,
            shortIntro: mover.shortIntro,
            description: mover.description,
            serviceTypes: {
              create: mover.serviceTypes.map((serviceType) => ({
                serviceType,
              })),
            },
            serviceRegions: {
              create: mover.serviceRegions.map((region) => ({ region })),
            },
          },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. 일반 유저 (CUSTOMER)
// ---------------------------------------------------------------------------

const customers = [
  {
    id: CUSTOMER.jimin,
    name: '한지민',
    email: 'han.jimin@example.com',
    phoneNumber: '01098760001',
    provider: 'LOCAL',
    providerId: null,
    region: 'SEOUL',
    imgUrl: 'https://picsum.photos/seed/customer-jimin/160/160',
    serviceTypes: ['SMALL_MOVE'],
  },
  {
    id: CUSTOMER.sehun,
    name: '오세훈',
    email: 'oh.sehun@example.com',
    phoneNumber: '01098760002',
    provider: 'LOCAL',
    providerId: null,
    region: 'GYEONGGI',
    imgUrl: 'https://picsum.photos/seed/customer-sehun/160/160',
    serviceTypes: ['HOME_MOVE'],
  },
  {
    id: CUSTOMER.nayoung,
    name: '유나영',
    email: 'yoo.nayoung@example.com',
    phoneNumber: '01098760003',
    provider: 'GOOGLE',
    providerId: 'google-102938475601',
    region: 'INCHEON',
    imgUrl: 'https://picsum.photos/seed/customer-nayoung/160/160',
    serviceTypes: ['SMALL_MOVE', 'HOME_MOVE'],
  },
  {
    id: CUSTOMER.donghyuk,
    name: '서동혁',
    email: 'seo.donghyuk@example.com',
    phoneNumber: '01098760004',
    provider: 'LOCAL',
    providerId: null,
    region: 'BUSAN',
    imgUrl: null,
    serviceTypes: ['SMALL_MOVE'],
  },
  {
    id: CUSTOMER.gayoung,
    name: '문가영',
    email: 'moon.gayoung@example.com',
    phoneNumber: '01098760005',
    provider: 'NAVER',
    providerId: 'naver-8f2c41ab',
    region: 'DAEJEON',
    imgUrl: 'https://picsum.photos/seed/customer-gayoung/160/160',
    serviceTypes: ['HOME_MOVE', 'OFFICE_MOVE'],
  },
  {
    id: CUSTOMER.jinwoo,
    name: '배진우',
    email: 'bae.jinwoo@example.com',
    phoneNumber: '01098760006',
    provider: 'KAKAO',
    providerId: 'kakao-3391027',
    region: 'SEOUL',
    imgUrl: null,
    serviceTypes: ['SMALL_MOVE'],
  },
] as const;

async function seedCustomers() {
  for (const customer of customers) {
    await prisma.user.create({
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        // 소셜 로그인 계정은 비밀번호를 두지 않습니다.
        password:
          customer.provider === 'LOCAL' ? hashPassword(SEED_PASSWORD) : null,
        role: 'CUSTOMER',
        provider: customer.provider,
        providerId: customer.providerId,
        customerProfile: {
          create: {
            imgUrl: customer.imgUrl,
            region: customer.region,
            serviceTypes: {
              create: customer.serviceTypes.map((serviceType) => ({
                serviceType,
              })),
            },
          },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 4. 견적 요청 + 견적
//    PENDING / CONFIRMED 상태의 요청은 고객당 1건만 존재할 수 있습니다.
//    (estimateRequest_customerId_active_key 부분 유니크 인덱스)
// ---------------------------------------------------------------------------

const estimateRequests = [
  {
    // 견적 대기 중 — 일반 견적 2건 + 지정 견적 1건 + 반려 1건
    id: REQUEST.jiminActive,
    customerId: CUSTOMER.jimin,
    serviceType: 'SMALL_MOVE',
    moveDate: days(12),
    createdAt: days(-3),
    status: 'PENDING',
    departureZipCode: 4524,
    departureAddress: '서울특별시 중구 세종대로 110 3층',
    arrivalZipCode: 6035,
    arrivalAddress: '서울특별시 강남구 가로수길 5 201호',
    estimates: [
      {
        id: ESTIMATE.jiminMinjae,
        moverId: MOVER.minjae,
        price: 310000,
        comment:
          '원룸 기준 2.5톤 차량 1대로 진행 가능합니다. 엘리베이터가 있어 사다리차는 필요 없습니다.',
        isDesignated: false,
        status: 'PROPOSED',
        rejectReason: null,
        createdAt: days(-2),
      },
      {
        id: ESTIMATE.jiminHaneul,
        moverId: MOVER.haneul,
        price: 350000,
        comment:
          '포장자재와 정리 인력 1명이 포함된 금액입니다. 당일 사진 기록을 남겨 드립니다.',
        isDesignated: false,
        status: 'PROPOSED',
        rejectReason: null,
        createdAt: days(-2),
      },
      {
        // 지정 견적 요청 — 아직 기사님이 금액을 보내지 않은 상태
        id: ESTIMATE.jiminSeojun,
        moverId: MOVER.seojun,
        price: null,
        comment: null,
        isDesignated: true,
        status: 'DESIGNATED',
        rejectReason: null,
        createdAt: days(-1),
      },
      {
        // 지정 견적 반려
        id: ESTIMATE.jiminYuri,
        moverId: MOVER.yuri,
        price: null,
        comment: null,
        isDesignated: true,
        status: 'REJECTED',
        rejectReason: '해당 날짜에 이미 확정된 이사 일정이 있어 어렵습니다.',
        createdAt: days(-2),
      },
    ],
  },
  {
    // 견적 확정 — 이사일 대기 중
    id: REQUEST.sehunConfirmed,
    customerId: CUSTOMER.sehun,
    serviceType: 'HOME_MOVE',
    moveDate: days(25),
    createdAt: days(-10),
    status: 'CONFIRMED',
    departureZipCode: 13529,
    departureAddress: '경기도 성남시 분당구 판교역로 235 102동 1503호',
    arrivalZipCode: 16489,
    arrivalAddress: '경기도 수원시 영통구 광교중앙로 145 305동 802호',
    estimates: [
      {
        id: ESTIMATE.sehunMinjae,
        moverId: MOVER.minjae,
        price: 780000,
        comment: '쓰리룸 기준 5톤 차량 1대, 작업자 3명으로 진행합니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-9),
      },
      {
        id: ESTIMATE.sehunYuri,
        moverId: MOVER.yuri,
        price: 850000,
        comment: '수납 정리까지 포함된 금액입니다.',
        isDesignated: false,
        status: 'NOT_SELECTED',
        rejectReason: null,
        createdAt: days(-9),
      },
      {
        id: ESTIMATE.sehunHaneul,
        moverId: MOVER.haneul,
        price: 920000,
        comment: '보관이사 전환도 가능합니다. 편하게 문의 주세요.',
        isDesignated: true,
        status: 'NOT_SELECTED',
        rejectReason: null,
        createdAt: days(-8),
      },
    ],
  },
  {
    // 이사 완료 — 리뷰 작성됨
    id: REQUEST.nayoungDone,
    customerId: CUSTOMER.nayoung,
    serviceType: 'HOME_MOVE',
    moveDate: days(-20),
    createdAt: days(-45),
    status: 'COMPLETED',
    departureZipCode: 21556,
    departureAddress: '인천광역시 남동구 예술로 149 201동 1102호',
    arrivalZipCode: 22382,
    arrivalAddress: '인천광역시 중구 영종대로 106 508호',
    estimates: [
      {
        id: ESTIMATE.nayoungHaneul,
        moverId: MOVER.haneul,
        price: 690000,
        comment: '영종도 진입 통행료가 포함된 금액입니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-44),
      },
      {
        id: ESTIMATE.nayoungSeojun,
        moverId: MOVER.seojun,
        price: 730000,
        comment: '오전 8시 출발 기준입니다.',
        isDesignated: false,
        status: 'NOT_SELECTED',
        rejectReason: null,
        createdAt: days(-43),
      },
    ],
  },
  {
    id: REQUEST.donghyukDone,
    customerId: CUSTOMER.donghyuk,
    serviceType: 'SMALL_MOVE',
    moveDate: days(-35),
    createdAt: days(-52),
    status: 'COMPLETED',
    departureZipCode: 48058,
    departureAddress: '부산광역시 해운대구 해운대해변로 264 1203호',
    arrivalZipCode: 46241,
    arrivalAddress: '부산광역시 금정구 부산대학로 63 302호',
    estimates: [
      {
        id: ESTIMATE.donghyukJihoon,
        moverId: MOVER.jihoon,
        price: 280000,
        comment: '4층 사다리차 비용이 포함되어 있습니다.',
        isDesignated: true,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-51),
      },
    ],
  },
  {
    // 확정하지 않은 채 이사일이 지난 요청
    id: REQUEST.gayoungExpired,
    customerId: CUSTOMER.gayoung,
    serviceType: 'OFFICE_MOVE',
    moveDate: days(-10),
    createdAt: days(-30),
    status: 'EXPIRED',
    departureZipCode: 35233,
    departureAddress: '대전광역시 서구 둔산중로 100 5층',
    arrivalZipCode: 34126,
    arrivalAddress: '대전광역시 유성구 대학로 291 산학협력관 8층',
    estimates: [
      {
        id: ESTIMATE.gayoungSeojun,
        moverId: MOVER.seojun,
        price: 2400000,
        comment: '주말 야간 작업 기준으로 산정했습니다.',
        isDesignated: false,
        status: 'EXPIRED',
        rejectReason: null,
        createdAt: days(-29),
      },
      {
        id: ESTIMATE.gayoungHaneul,
        moverId: MOVER.haneul,
        price: 2650000,
        comment: 'IT 장비 별도 포장이 포함된 금액입니다.',
        isDesignated: false,
        status: 'EXPIRED',
        rejectReason: null,
        createdAt: days(-28),
      },
    ],
  },
  {
    // 한지민 고객의 과거 이사 이력
    id: REQUEST.jiminDone,
    customerId: CUSTOMER.jimin,
    serviceType: 'SMALL_MOVE',
    moveDate: days(-120),
    createdAt: days(-140),
    status: 'COMPLETED',
    departureZipCode: 3722,
    departureAddress: '서울특별시 서대문구 연희로 25 401호',
    arrivalZipCode: 4524,
    arrivalAddress: '서울특별시 중구 세종대로 110 3층',
    estimates: [
      {
        id: ESTIMATE.jiminDoneMinjae,
        moverId: MOVER.minjae,
        price: 260000,
        comment: '짐이 많지 않아 1톤 차량으로 충분합니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-139),
      },
    ],
  },
  {
    // 지정 견적을 막 보낸 신규 요청
    id: REQUEST.jinwooActive,
    customerId: CUSTOMER.jinwoo,
    serviceType: 'SMALL_MOVE',
    moveDate: days(5),
    createdAt: days(-1),
    status: 'PENDING',
    departureZipCode: 7229,
    departureAddress: '서울특별시 영등포구 은행로 30 지하 1층',
    arrivalZipCode: 8390,
    arrivalAddress: '서울특별시 구로구 디지털로 300 1108호',
    estimates: [
      {
        id: ESTIMATE.jinwooMinjae,
        moverId: MOVER.minjae,
        price: null,
        comment: null,
        isDesignated: true,
        status: 'DESIGNATED',
        rejectReason: null,
        createdAt: days(-1),
      },
      {
        id: ESTIMATE.jinwooHaneul,
        moverId: MOVER.haneul,
        price: 295000,
        comment: '지하 1층에서 11층 이사로 사다리차 1회 사용 기준입니다.',
        isDesignated: false,
        status: 'PROPOSED',
        rejectReason: null,
        createdAt: days(-1),
      },
    ],
  },
  {
    id: REQUEST.gayoungDone,
    customerId: CUSTOMER.gayoung,
    serviceType: 'HOME_MOVE',
    moveDate: days(-60),
    createdAt: days(-80),
    status: 'COMPLETED',
    departureZipCode: 30121,
    departureAddress: '세종특별자치시 한누리대로 2130 105동 704호',
    arrivalZipCode: 35233,
    arrivalAddress: '대전광역시 서구 둔산중로 100 5층',
    estimates: [
      {
        id: ESTIMATE.gayoungDoneYuri,
        moverId: MOVER.yuri,
        price: 640000,
        comment: '세종에서 대전 구간은 당일 오전에 마무리됩니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-79),
      },
    ],
  },
  {
    id: REQUEST.sehunDone,
    customerId: CUSTOMER.sehun,
    serviceType: 'HOME_MOVE',
    moveDate: days(-90),
    createdAt: days(-110),
    status: 'COMPLETED',
    departureZipCode: 13487,
    departureAddress: '경기도 성남시 분당구 대왕판교로 660 803호',
    arrivalZipCode: 13529,
    arrivalAddress: '경기도 성남시 분당구 판교역로 235 102동 1503호',
    estimates: [
      {
        id: ESTIMATE.sehunDoneHaneul,
        moverId: MOVER.haneul,
        price: 810000,
        comment: '피아노 별도 운반 비용이 포함되어 있습니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-109),
      },
      {
        id: ESTIMATE.sehunDoneMinjae,
        moverId: MOVER.minjae,
        price: 760000,
        comment: '피아노는 협력 업체를 통해 별도로 진행합니다.',
        isDesignated: false,
        status: 'NOT_SELECTED',
        rejectReason: null,
        createdAt: days(-108),
      },
    ],
  },
  {
    id: REQUEST.jiminDoneOld,
    customerId: CUSTOMER.jimin,
    serviceType: 'HOME_MOVE',
    moveDate: days(-200),
    createdAt: days(-220),
    status: 'COMPLETED',
    departureZipCode: 6236,
    departureAddress: '서울특별시 강남구 테헤란로 152 1704호',
    arrivalZipCode: 3722,
    arrivalAddress: '서울특별시 서대문구 연희로 25 401호',
    estimates: [
      {
        id: ESTIMATE.jiminOldHaneul,
        moverId: MOVER.haneul,
        price: 720000,
        comment: '평일 오전 출발 기준으로 할인된 금액입니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-219),
      },
    ],
  },
] as const;

async function seedEstimateRequests() {
  for (const request of estimateRequests) {
    await prisma.estimateRequest.create({
      data: {
        id: request.id,
        customerId: request.customerId,
        serviceType: request.serviceType,
        moveDate: request.moveDate,
        departureZipCode: request.departureZipCode,
        departureAddress: request.departureAddress,
        arrivalZipCode: request.arrivalZipCode,
        arrivalAddress: request.arrivalAddress,
        status: request.status,
        createdAt: request.createdAt,
        estimates: {
          create: request.estimates.map((estimate) => ({
            id: estimate.id,
            moverId: estimate.moverId,
            price: estimate.price,
            comment: estimate.comment,
            isDesignated: estimate.isDesignated,
            status: estimate.status,
            rejectReason: estimate.rejectReason,
            createdAt: estimate.createdAt,
          })),
        },
      },
    });
  }

  // 진행 중(PENDING / CONFIRMED)인 요청을 고객의 활성 견적요청으로 연결합니다.
  const activePairs = [
    { customerId: CUSTOMER.jimin, requestId: REQUEST.jiminActive },
    { customerId: CUSTOMER.sehun, requestId: REQUEST.sehunConfirmed },
    { customerId: CUSTOMER.jinwoo, requestId: REQUEST.jinwooActive },
  ];

  for (const { customerId, requestId } of activePairs) {
    await prisma.customerProfile.update({
      where: { userId: customerId },
      data: { activeEstimateRequestId: requestId },
    });
  }
}

// ---------------------------------------------------------------------------
// 5. 리뷰 — 이사가 완료된 확정 견적에만 작성됩니다.
// ---------------------------------------------------------------------------

const reviews = [
  {
    estimateId: ESTIMATE.nayoungHaneul,
    customerId: CUSTOMER.nayoung,
    moverId: MOVER.haneul,
    rating: 5,
    content:
      '섬 지역이라 걱정했는데 시간 약속을 정확히 지켜주셨어요. 짐 하나 상한 것 없이 마무리됐습니다.',
    createdAt: days(-19),
  },
  {
    estimateId: ESTIMATE.donghyukJihoon,
    customerId: CUSTOMER.donghyuk,
    moverId: MOVER.jihoon,
    rating: 4,
    content:
      '가격 대비 만족스러웠습니다. 사다리차 비용을 미리 알려주셔서 추가 요금 걱정이 없었어요.',
    createdAt: days(-33),
  },
  {
    estimateId: ESTIMATE.jiminDoneMinjae,
    customerId: CUSTOMER.jimin,
    moverId: MOVER.minjae,
    rating: 5,
    content:
      '두 번째 이용인데 역시 꼼꼼하십니다. 가구 배치까지 다시 잡아주셔서 바로 정리됐어요.',
    createdAt: days(-118),
  },
  {
    estimateId: ESTIMATE.gayoungDoneYuri,
    customerId: CUSTOMER.gayoung,
    moverId: MOVER.yuri,
    rating: 3,
    content:
      '작업 자체는 깔끔했지만 출발이 예정보다 한 시간 늦어졌습니다. 그 외에는 무난했어요.',
    createdAt: days(-58),
  },
  {
    estimateId: ESTIMATE.sehunDoneHaneul,
    customerId: CUSTOMER.sehun,
    moverId: MOVER.haneul,
    rating: 4,
    content:
      '피아노까지 안전하게 옮겨주셨습니다. 사진 기록을 남겨주셔서 확인이 편했어요.',
    createdAt: days(-88),
  },
  {
    estimateId: ESTIMATE.jiminOldHaneul,
    customerId: CUSTOMER.jimin,
    moverId: MOVER.haneul,
    rating: 5,
    content:
      '포장부터 정리까지 하루 만에 끝났습니다. 다음 이사에도 다시 부탁드릴 생각이에요.',
    createdAt: days(-198),
  },
] as const;

async function seedReviews() {
  await prisma.review.createMany({ data: [...reviews] });
}

// ---------------------------------------------------------------------------
// 6. 찜
// ---------------------------------------------------------------------------

const likes = [
  { customerId: CUSTOMER.jimin, moverId: MOVER.minjae },
  { customerId: CUSTOMER.jimin, moverId: MOVER.haneul },
  { customerId: CUSTOMER.sehun, moverId: MOVER.minjae },
  { customerId: CUSTOMER.sehun, moverId: MOVER.haneul },
  { customerId: CUSTOMER.nayoung, moverId: MOVER.haneul },
  { customerId: CUSTOMER.donghyuk, moverId: MOVER.jihoon },
  { customerId: CUSTOMER.gayoung, moverId: MOVER.yuri },
  { customerId: CUSTOMER.jinwoo, moverId: MOVER.haneul },
] as const;

async function seedLikes() {
  await prisma.like.createMany({ data: [...likes] });
}

// ---------------------------------------------------------------------------
// 7. 알림
// ---------------------------------------------------------------------------

const notifications = [
  {
    userId: CUSTOMER.jimin,
    type: 'NEW_ESTIMATE',
    content: '김민재 기사님이 견적을 보냈어요.',
    targetPath: ESTIMATE.jiminMinjae,
    isRead: false,
    createdAt: days(-2),
  },
  {
    userId: CUSTOMER.jimin,
    type: 'NEW_ESTIMATE',
    content: '정하늘 기사님이 견적을 보냈어요.',
    targetPath: ESTIMATE.jiminHaneul,
    isRead: true,
    createdAt: days(-2),
  },
  {
    userId: MOVER.minjae,
    type: 'NEW_REQUEST',
    content: '한지민 고객님의 소형이사 견적 요청이 도착했어요.',
    targetPath: REQUEST.jiminActive,
    isRead: true,
    createdAt: days(-3),
  },
  {
    userId: MOVER.seojun,
    type: 'NEW_REQUEST',
    content: '한지민 고객님이 지정 견적을 요청했어요.',
    targetPath: REQUEST.jiminActive,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.sehun,
    type: 'ESTIMATE_CONFIRMED',
    content: '김민재 기사님의 견적을 확정했어요.',
    targetPath: ESTIMATE.sehunMinjae,
    isRead: true,
    createdAt: days(-8),
  },
  {
    userId: MOVER.minjae,
    type: 'ESTIMATE_CONFIRMED',
    content: '오세훈 고객님이 견적을 확정했어요.',
    targetPath: ESTIMATE.sehunMinjae,
    isRead: false,
    createdAt: days(-8),
  },
  {
    userId: CUSTOMER.sehun,
    type: 'MOVE_DAY',
    content: '이사가 하루 남았어요. 준비물을 확인해 주세요.',
    targetPath: REQUEST.sehunConfirmed,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: MOVER.haneul,
    type: 'NEW_REQUEST',
    content: '배진우 고객님의 소형이사 견적 요청이 도착했어요.',
    targetPath: REQUEST.jinwooActive,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.jinwoo,
    type: 'NEW_ESTIMATE',
    content: '정하늘 기사님이 견적을 보냈어요.',
    targetPath: ESTIMATE.jinwooHaneul,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.nayoung,
    type: 'MOVE_DAY',
    content: '오늘은 이사 당일이에요. 기사님께 연락해 보세요.',
    targetPath: REQUEST.nayoungDone,
    isRead: true,
    createdAt: days(-20),
  },
] as const;

async function seedNotifications() {
  await prisma.notification.createMany({ data: [...notifications] });
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

async function main() {
  console.log('기존 데이터 삭제 중...');
  await clear();

  console.log('기사님 계정 생성 중...');
  await seedMovers();

  console.log('일반 유저 계정 생성 중...');
  await seedCustomers();

  console.log('견적 요청 / 견적 생성 중...');
  await seedEstimateRequests();

  console.log('리뷰 생성 중...');
  await seedReviews();

  console.log('찜 생성 중...');
  await seedLikes();

  console.log('알림 생성 중...');
  await seedNotifications();

  const estimateCount = estimateRequests.reduce(
    (sum, request) => sum + request.estimates.length,
    0
  );

  console.log(
    [
      '시드 완료',
      `- 기사님 ${movers.length}명 / 일반 유저 ${customers.length}명`,
      `- 견적 요청 ${estimateRequests.length}건 / 견적 ${estimateCount}건`,
      `- 리뷰 ${reviews.length}건 / 찜 ${likes.length}건 / 알림 ${notifications.length}건`,
      `- 로컬 계정 공통 비밀번호: ${SEED_PASSWORD}`,
    ].join('\n')
  );
}

main()
  .catch((error) => {
    console.error('시드 실패:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
