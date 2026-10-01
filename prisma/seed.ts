/* eslint-disable no-console -- 시드 실행 로그는 콘솔로 출력합니다. */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  EstimateRequestStatus,
  EstimateStatus,
  NotificationType,
  PrismaClient,
} from '../src/generated/prisma/client';
import notificationMessage from '../src/modules/notification/notificationMessage';
import { hashPassword } from '../src/utils/hash';

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
 * 분량용 계정 이름 생성 — 성과 이름을 다른 주기로 돌려 조합합니다.
 * 성씨가 골고루 섞여야 "받은 요청"의 고객 이름 검색(keyword)을 확인할 수 있습니다.
 */
const SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
  '황',
  '안',
  '송',
  '전',
  '홍',
  '고',
  '문',
  '양',
  '손',
  '배',
] as const;

const GIVEN_NAMES = [
  '도현',
  '서준',
  '하윤',
  '지우',
  '예준',
  '수아',
  '민재',
  '서연',
  '준호',
  '다은',
  '태윤',
  '채원',
  '현우',
  '유진',
  '건우',
  '소율',
  '지훈',
  '나윤',
  '성민',
  '아린',
  '재원',
  '시은',
  '동하',
  '예린',
  '우진',
] as const;

/**
 * 성과 이름을 서로 다른 보폭으로 골라 이름을 만듭니다.
 * 보폭 7은 목록 길이 25와 서로소라 25명까지 이름이 겹치지 않습니다.
 * offset으로 기사님/일반 유저의 이름 목록을 어긋나게 둡니다.
 */
const seedName = (index: number, offset = 0) =>
  `${SURNAMES[(index + offset) % SURNAMES.length]}${
    GIVEN_NAMES[((index + offset) * 7) % GIVEN_NAMES.length]
  }`;

/** 시드로 생성되는 모든 로컬 계정의 공통 비밀번호 — 실제 /auth/login으로 로그인 가능합니다. */
const SEED_PASSWORD = 'test1234!';

/**
 * 공통 비밀번호의 bcrypt 해시.
 * 인증 모듈(src/utils/hash.ts)과 같은 함수를 써야 시드 계정으로 로그인할 수 있습니다.
 * 모든 계정이 같은 비밀번호라 main()에서 한 번만 계산해 재사용합니다.
 */
let seedPasswordHash = '';

/**
 * main()이 계산해 둔 해시를 돌려줍니다.
 * 초기화 전에 호출하면 빈 문자열이 비밀번호로 저장돼 시드 계정 로그인이
 * 조용히 실패하므로, 그 전에 즉시 실패시킵니다.
 */
const getSeedPasswordHash = () => {
  if (!seedPasswordHash) {
    throw new Error(
      'seedPasswordHash가 초기화되지 않았습니다. main()에서 먼저 계산해야 합니다.'
    );
  }
  return seedPasswordHash;
};

// ---------------------------------------------------------------------------
// 고정 ID — 데이터 간 참조를 위해 UUID를 하드코딩합니다.
// ---------------------------------------------------------------------------

/** 고정 UUID 순번 생성 — seqId('30000000-0000-4000-8000-', 15) → ...-000000000015 */
const seqId = (prefix: string, sequence: number) =>
  `${prefix}${String(sequence).padStart(12, '0')}`;

/** 아래 상수들과 페이지네이션용 생성 데이터가 함께 쓰는 UUID 접두사 */
const MOVER_ID_PREFIX = '10000000-0000-4000-8000-';
const RECEIVED_CUSTOMER_ID_PREFIX = '21000000-0000-4000-8000-';
const REQUEST_ID_PREFIX = '30000000-0000-4000-8000-';
const RECEIVED_REQUEST_ID_PREFIX = '31000000-0000-4000-8000-';
const ESTIMATE_ID_PREFIX = '40000000-0000-4000-8000-';

const MOVER = {
  minjae: '10000000-0000-4000-8000-000000000001',
  seojun: '10000000-0000-4000-8000-000000000002',
  jihoon: '10000000-0000-4000-8000-000000000003',
  yuri: '10000000-0000-4000-8000-000000000004',
  haneul: '10000000-0000-4000-8000-000000000005',
} as const;

/**
 * 발표 시연용 계정 — 목록이 이미 채워져 있어야 하므로 분량용 데이터(4-3, 6, 7)의
 * 주인을 이 두 계정으로 둡니다. 순번 900번대는 생성 데이터와 겹치지 않습니다.
 */
const DEMO = {
  mover: '10000000-0000-4000-8000-000000000900',
  customer: '20000000-0000-4000-8000-000000000900',
  /** 시연용 일반회원의 진행 중(PENDING) 견적 요청 */
  request: '30000000-0000-4000-8000-000000000900',
  designatedEstimate: '40000000-0000-4000-8000-000000000901',
  proposedEstimate1: '40000000-0000-4000-8000-000000000902',
  proposedEstimate2: '40000000-0000-4000-8000-000000000903',
  rejectedEstimate: '40000000-0000-4000-8000-000000000904',
} as const;

/** 시연 기사님 지정/반려 전용 UUID 접두사 — 받은 요청 픽스처(1~16)와 겹치지 않습니다. */
const DEMO_CUSTOMER_ID_PREFIX = '24000000-0000-4000-8000-';
const DEMO_REQUEST_ID_PREFIX = '34000000-0000-4000-8000-';
const DEMO_ESTIMATE_ID_PREFIX = '44000000-0000-4000-8000-';

const CUSTOMER = {
  jimin: '20000000-0000-4000-8000-000000000001',
  sehun: '20000000-0000-4000-8000-000000000002',
  nayoung: '20000000-0000-4000-8000-000000000003',
  donghyuk: '20000000-0000-4000-8000-000000000004',
  gayoung: '20000000-0000-4000-8000-000000000005',
  jinwoo: '20000000-0000-4000-8000-000000000006',
} as const;

/**
 * 기사님 "받은 요청" 목록(GET /estimate-requests/received) 확인용 고객입니다.
 * 진행 중(PENDING) 요청은 고객당 1건만 가능해 요청 수만큼 고객이 필요합니다.
 * 이름은 검색(keyword) 확인을 위해 김/이/박 성씨를 섞었습니다.
 */
const RECEIVED_CUSTOMER = {
  kimSeoul: '21000000-0000-4000-8000-000000000001',
  kimGyeonggi: '21000000-0000-4000-8000-000000000002',
  kimIncheon: '21000000-0000-4000-8000-000000000003',
  leeSeoul: '21000000-0000-4000-8000-000000000004',
  leeGyeonggi: '21000000-0000-4000-8000-000000000005',
  parkIncheon: '21000000-0000-4000-8000-000000000006',
  parkBusan: '21000000-0000-4000-8000-000000000007',
  parkDaejeon: '21000000-0000-4000-8000-000000000008',
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
  jiminDoneNoReview1: '30000000-0000-4000-8000-000000000011',
  jiminDoneNoReview2: '30000000-0000-4000-8000-000000000012',
  jiminExpired1: '30000000-0000-4000-8000-000000000013',
  jiminExpired2: '30000000-0000-4000-8000-000000000014',
} as const;

/** 받은 요청 목록 확인용 PENDING 요청 (RECEIVED_CUSTOMER 와 1:1) */
const RECEIVED_REQUEST = {
  kimSeoul: '31000000-0000-4000-8000-000000000001',
  kimGyeonggi: '31000000-0000-4000-8000-000000000002',
  kimIncheon: '31000000-0000-4000-8000-000000000003',
  leeSeoul: '31000000-0000-4000-8000-000000000004',
  leeGyeonggi: '31000000-0000-4000-8000-000000000005',
  parkIncheon: '31000000-0000-4000-8000-000000000006',
  parkBusan: '31000000-0000-4000-8000-000000000007',
  parkDaejeon: '31000000-0000-4000-8000-000000000008',
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
  jiminNoReview1Minjae: '40000000-0000-4000-8000-000000000020',
  jiminNoReview2Haneul: '40000000-0000-4000-8000-000000000021',
  jiminExpired1Seojun: '40000000-0000-4000-8000-000000000022',
  jiminExpired2Yuri: '40000000-0000-4000-8000-000000000023',
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

// ---------------------------------------------------------------------------
// 2-1. 기사님 찾기(GET /mover) 페이지네이션 확인용 — 기본 size가 10이라
//      고정 기사님 5명만으로는 nextCursor가 내려오지 않습니다. 25명을 더 만듭니다.
//      경력·서비스·지역을 한 칸씩 밀어가며 배정해 정렬·필터도 함께 확인됩니다.
//      지역 필터를 걸어도 한 페이지가 넘도록 수도권에 절반 이상을 배치합니다.
// ---------------------------------------------------------------------------

/** 추가로 만들 기사님 수 — 이름 생성기(seedName) 특성상 25명까지 이름이 겹치지 않습니다. */
const EXTRA_MOVER_COUNT = 25;

const extraMoverServiceTypes = [
  ['SMALL_MOVE'],
  ['HOME_MOVE'],
  ['OFFICE_MOVE'],
  ['SMALL_MOVE', 'HOME_MOVE'],
  ['HOME_MOVE', 'OFFICE_MOVE'],
] as const;

// 앞 4개(수도권)를 더 자주 돌게 두어 SEOUL 필터만으로도 10명이 넘습니다.
const extraMoverServiceRegions = [
  ['SEOUL', 'GYEONGGI'],
  ['SEOUL', 'INCHEON'],
  ['SEOUL', 'GYEONGGI', 'INCHEON'],
  ['SEOUL'],
  ['GYEONGGI', 'INCHEON'],
  ['BUSAN', 'GYEONGNAM'],
  ['DAEJEON', 'CHUNGNAM', 'SEJONG'],
  ['GWANGJU', 'JEONNAM'],
  ['DAEGU', 'GYEONGBUK'],
] as const;

const extraMoverIntros = [
  '견적서에 적힌 금액 그대로, 추가 요금 없이 진행합니다.',
  '포장자재부터 정리까지 한 팀이 끝까지 책임집니다.',
  '주말·공휴일 이사도 추가금 없이 가능합니다.',
  '이사 전날 최종 확인 전화를 꼭 드립니다.',
  '좁은 골목·엘리베이터 없는 건물 작업 경험이 많습니다.',
] as const;

/** 고정 기사님 5명이 쓴 마지막 순번 — 추가 기사님은 여기서 이어 붙입니다. */
const LAST_MOVER_SEQUENCE = 5;

const paginationMovers = Array.from(
  { length: EXTRA_MOVER_COUNT },
  (_unusedMover, index) => {
    const sequence = LAST_MOVER_SEQUENCE + index + 1;
    const name = seedName(index);
    // 경력이 7개월씩 벌어져 sortBy=career 결과 순서가 눈에 보입니다.
    const careerMonths = 14 + index * 7;

    return {
      id: seqId(MOVER_ID_PREFIX, sequence),
      name,
      email: `mover${sequence}@moving.kr`,
      phoneNumber: `0102346${String(sequence).padStart(4, '0')}`,
      // 별명은 이름(성 제외) + 업체명 — 최대 10자 제한을 넘지 않습니다.
      nickname: `${name.slice(1)} 이사센터`,
      careerMonths,
      shortIntro: extraMoverIntros[index % extraMoverIntros.length],
      description: `${name} 기사입니다. ${Math.floor(careerMonths / 12)}년간 이사를 진행했습니다. 사전 확인 후 견적을 드리고, 작업 당일에는 사진으로 기록을 남겨 드립니다.`,
      imgUrl: `https://picsum.photos/seed/mover-extra-${sequence}/240/240`,
      serviceTypes:
        extraMoverServiceTypes[index % extraMoverServiceTypes.length],
      serviceRegions:
        extraMoverServiceRegions[index % extraMoverServiceRegions.length],
    };
  }
);

// ---------------------------------------------------------------------------
// 2-2. 발표 시연용 기사회원
//      수도권 전역 + 3개 서비스를 모두 맡아 "받은 요청" 목록이 비지 않습니다.
//      확정 견적과 리뷰는 4-3 블록이 이 기사님 앞으로 만들어 줍니다.
// ---------------------------------------------------------------------------

const demoMover = {
  id: DEMO.mover,
  name: '나기사',
  email: 'mover@demo.kr',
  phoneNumber: '01099990001',
  nickname: '데모 프리미엄이사',
  careerMonths: 132,
  shortIntro: '11년째 수도권에서 이사만 해온 팀입니다.',
  description:
    '소형·가정·사무실 이사를 모두 진행합니다. 사전 방문 확인 후 견적을 드리고, 작업 전 과정을 사진으로 남겨 드립니다. 파손이 생기면 전액 보상합니다.',
  imgUrl: 'https://picsum.photos/seed/mover-demo/240/240',
  serviceTypes: ['SMALL_MOVE', 'HOME_MOVE', 'OFFICE_MOVE'],
  serviceRegions: ['SEOUL', 'GYEONGGI', 'INCHEON'],
} as const;

/** 고정 기사님 + 페이지네이션용 기사님 + 시연용 기사님 */
const allMovers = [...movers, ...paginationMovers, demoMover];

async function seedMovers() {
  for (const mover of allMovers) {
    await prisma.user.create({
      data: {
        id: mover.id,
        name: mover.name,
        email: mover.email,
        phoneNumber: mover.phoneNumber,
        password: getSeedPasswordHash(),
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

// ---------------------------------------------------------------------------
// 3-1. 분량용 일반 유저 — 고정 6명만으로는 기사님 한 분에게 붙는 리뷰가
//      전부 같은 작성자가 되어 버립니다. 20명을 더 만들어 4-4에서 완료된
//      이사 1건씩을 붙이고, 리뷰·찜을 기사님들에게 흩뿌립니다.
//      소셜 로그인 계정도 섞어 provider별 표시를 함께 확인할 수 있습니다.
// ---------------------------------------------------------------------------

const EXTRA_CUSTOMER_COUNT = 20;

/** 고정 일반 유저 6명이 쓴 마지막 순번 — 추가 유저는 여기서 이어 붙입니다. */
const LAST_CUSTOMER_SEQUENCE = 6;

const CUSTOMER_ID_PREFIX = '20000000-0000-4000-8000-';

const extraCustomerRegions = [
  'SEOUL',
  'GYEONGGI',
  'INCHEON',
  'BUSAN',
  'DAEJEON',
  'DAEGU',
  'GWANGJU',
] as const;

const extraCustomerServiceTypes = [
  ['SMALL_MOVE'],
  ['HOME_MOVE'],
  ['OFFICE_MOVE'],
  ['SMALL_MOVE', 'HOME_MOVE'],
] as const;

const extraCustomerProviders = ['LOCAL', 'GOOGLE', 'KAKAO', 'NAVER'] as const;

const paginationCustomers = Array.from(
  { length: EXTRA_CUSTOMER_COUNT },
  (_unusedCustomer, index) => {
    const sequence = LAST_CUSTOMER_SEQUENCE + index + 1;
    // 기사님과 이름 목록이 겹치지 않도록 성·이름 시작점을 어긋나게 둡니다.
    const name = seedName(index, 11);
    const provider =
      extraCustomerProviders[index % extraCustomerProviders.length];

    return {
      id: seqId(CUSTOMER_ID_PREFIX, sequence),
      name,
      email: `customer${sequence}@example.com`,
      phoneNumber: `0109876${String(sequence).padStart(4, '0')}`,
      provider,
      // 소셜 계정은 제공자가 발급한 고유 ID가 있어야 합니다.
      providerId:
        provider === 'LOCAL'
          ? null
          : `${provider.toLowerCase()}-seed-${sequence}`,
      region: extraCustomerRegions[index % extraCustomerRegions.length],
      // 3명 중 1명은 프로필 이미지가 없는 상태로 둡니다.
      imgUrl:
        index % 3 === 0
          ? null
          : `https://picsum.photos/seed/customer-extra-${sequence}/160/160`,
      serviceTypes:
        extraCustomerServiceTypes[index % extraCustomerServiceTypes.length],
    };
  }
);

// ---------------------------------------------------------------------------
// 3-2. 발표 시연용 일반회원
//      진행 중 견적 요청(4-5)과 이사 내역·리뷰·찜·알림(4-3, 6, 7)을 모두 갖습니다.
// ---------------------------------------------------------------------------

const demoCustomer = {
  id: DEMO.customer,
  name: '나고객',
  email: 'customer@demo.kr',
  phoneNumber: '01099990002',
  provider: 'LOCAL',
  providerId: null,
  region: 'SEOUL',
  imgUrl: 'https://picsum.photos/seed/customer-demo/160/160',
  serviceTypes: ['SMALL_MOVE', 'HOME_MOVE'],
} as const;

/** 고정 일반 유저 + 분량용 일반 유저 + 시연용 일반회원 */
const allCustomers = [...customers, ...paginationCustomers, demoCustomer];

async function seedCustomers() {
  for (const customer of allCustomers) {
    await prisma.user.create({
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        // 소셜 로그인 계정은 비밀번호를 두지 않습니다.
        password: customer.provider === 'LOCAL' ? getSeedPasswordHash() : null,
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
    departureZipCode: '04524',
    departureAddress: '서울특별시 중구 세종대로 110 3층',
    arrivalZipCode: '06035',
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
    departureZipCode: '13529',
    departureAddress: '경기도 성남시 분당구 판교역로 235 102동 1503호',
    arrivalZipCode: '16489',
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
    departureZipCode: '21556',
    departureAddress: '인천광역시 남동구 예술로 149 201동 1102호',
    arrivalZipCode: '22382',
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
    departureZipCode: '48058',
    departureAddress: '부산광역시 해운대구 해운대해변로 264 1203호',
    arrivalZipCode: '46241',
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
    departureZipCode: '35233',
    departureAddress: '대전광역시 서구 둔산중로 100 5층',
    arrivalZipCode: '34126',
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
    departureZipCode: '03722',
    departureAddress: '서울특별시 서대문구 연희로 25 401호',
    arrivalZipCode: '04524',
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
    departureZipCode: '07229',
    departureAddress: '서울특별시 영등포구 은행로 30 지하 1층',
    arrivalZipCode: '08390',
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
    departureZipCode: '30121',
    departureAddress: '세종특별자치시 한누리대로 2130 105동 704호',
    arrivalZipCode: '35233',
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
    departureZipCode: '13487',
    departureAddress: '경기도 성남시 분당구 대왕판교로 660 803호',
    arrivalZipCode: '13529',
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
    departureZipCode: '06236',
    departureAddress: '서울특별시 강남구 테헤란로 152 1704호',
    arrivalZipCode: '03722',
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
  {
    // 이사 완료 — 리뷰 미작성 (한지민)
    id: REQUEST.jiminDoneNoReview1,
    customerId: CUSTOMER.jimin,
    serviceType: 'SMALL_MOVE',
    moveDate: days(-7),
    createdAt: days(-25),
    status: 'COMPLETED',
    departureZipCode: '04524',
    departureAddress: '서울특별시 중구 세종대로 110 3층',
    arrivalZipCode: '06236',
    arrivalAddress: '서울특별시 강남구 테헤란로 50 801호',
    estimates: [
      {
        id: ESTIMATE.jiminNoReview1Minjae,
        moverId: MOVER.minjae,
        price: 270000,
        comment: '원룸 기준 1톤 차량으로 충분합니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-24),
      },
    ],
  },
  {
    // 이사 완료 — 리뷰 미작성 (한지민)
    id: REQUEST.jiminDoneNoReview2,
    customerId: CUSTOMER.jimin,
    serviceType: 'HOME_MOVE',
    moveDate: days(-14),
    createdAt: days(-35),
    status: 'COMPLETED',
    departureZipCode: '03722',
    departureAddress: '서울특별시 서대문구 연희로 25 401호',
    arrivalZipCode: '04524',
    arrivalAddress: '서울특별시 중구 을지로 100 202호',
    estimates: [
      {
        id: ESTIMATE.jiminNoReview2Haneul,
        moverId: MOVER.haneul,
        price: 550000,
        comment: '가전제품 포장 포함 기준입니다.',
        isDesignated: false,
        status: 'ACCEPTED',
        rejectReason: null,
        createdAt: days(-34),
      },
    ],
  },
  {
    // 확정하지 않아 만료 — 리뷰 불가 (한지민)
    id: REQUEST.jiminExpired1,
    customerId: CUSTOMER.jimin,
    serviceType: 'SMALL_MOVE',
    moveDate: days(-2),
    createdAt: days(-10),
    status: 'EXPIRED',
    departureZipCode: '04524',
    departureAddress: '서울특별시 중구 명동길 14 301호',
    arrivalZipCode: '03722',
    arrivalAddress: '서울특별시 서대문구 홍제천로 88 102호',
    estimates: [
      {
        id: ESTIMATE.jiminExpired1Seojun,
        moverId: MOVER.seojun,
        price: 320000,
        comment: '당일 오후 출발 기준입니다.',
        isDesignated: false,
        status: 'EXPIRED',
        rejectReason: null,
        createdAt: days(-9),
      },
    ],
  },
  {
    // 확정하지 않아 만료 — 리뷰 불가 (한지민)
    id: REQUEST.jiminExpired2,
    customerId: CUSTOMER.jimin,
    serviceType: 'HOME_MOVE',
    moveDate: days(-18),
    createdAt: days(-40),
    status: 'EXPIRED',
    departureZipCode: '06236',
    departureAddress: '서울특별시 강남구 역삼로 168 1003호',
    arrivalZipCode: '03722',
    arrivalAddress: '서울특별시 서대문구 신촌로 83 501호',
    estimates: [
      {
        id: ESTIMATE.jiminExpired2Yuri,
        moverId: MOVER.yuri,
        price: 610000,
        comment: '고층 엘리베이터 이용 가능하여 사다리차 불필요합니다.',
        isDesignated: false,
        status: 'EXPIRED',
        rejectReason: null,
        createdAt: days(-39),
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// 4-2. 커서 페이지네이션 확인용 — 마감된 견적 요청 + 기사님 견적 (한지민)
//    GET /estimates?status=closed 의 기본 size가 10건이라, 마감된 요청이 10건을
//    넘어야 nextCursor가 내려오고 프론트 무한 스크롤 2페이지째를 확인할 수 있습니다.
//    위 고정 픽스처만으로는 한지민의 마감 요청이 6건뿐이라 10건을 더 만듭니다.
//    내용 차이가 거의 없는 분량용 데이터라 하드코딩 대신 생성합니다.
// ---------------------------------------------------------------------------

/** 위 REQUEST / ESTIMATE 상수가 쓴 마지막 순번 — 새 데이터는 여기서 이어 붙입니다. */
const LAST_REQUEST_SEQUENCE = 14;
const LAST_ESTIMATE_SEQUENCE = 23;

/** 요청마다 돌려 쓰는 출발지/도착지 */
const paginationRoutes = [
  {
    serviceType: 'SMALL_MOVE',
    departureZipCode: '04524',
    departureAddress: '서울특별시 중구 퇴계로 100 502호',
    arrivalZipCode: '06236',
    arrivalAddress: '서울특별시 강남구 테헤란로 152 1201호',
  },
  {
    serviceType: 'HOME_MOVE',
    departureZipCode: '03722',
    departureAddress: '서울특별시 서대문구 연세로 50 301호',
    arrivalZipCode: '07222',
    arrivalAddress: '서울특별시 영등포구 여의대로 108 1802호',
  },
  {
    serviceType: 'OFFICE_MOVE',
    departureZipCode: '06035',
    departureAddress: '서울특별시 강남구 가로수길 43 2층',
    arrivalZipCode: '04539',
    arrivalAddress: '서울특별시 중구 남대문로 63 8층',
  },
  {
    serviceType: 'HOME_MOVE',
    departureZipCode: '13529',
    departureAddress: '경기도 성남시 분당구 판교로 255 104동 902호',
    arrivalZipCode: '16489',
    arrivalAddress: '경기도 수원시 영통구 월드컵로 206 201동 1103호',
  },
  {
    serviceType: 'SMALL_MOVE',
    departureZipCode: '22382',
    departureAddress: '인천광역시 중구 영종대로 106 508호',
    arrivalZipCode: '21999',
    arrivalAddress: '인천광역시 연수구 송도과학로 32 1504호',
  },
] as const;

const paginationComments = [
  '원룸 기준 2.5톤 차량 1대로 진행합니다. 엘리베이터가 있어 사다리차는 필요 없습니다.',
  '포장자재와 정리 인력 1명이 포함된 금액입니다. 당일 사진 기록을 남겨 드립니다.',
  '사무실 집기 분해·조립까지 포함해서 안내드립니다.',
  '가전제품은 별도 완충 포장 후 마지막에 싣습니다.',
  '주말 이사라 작업자 1명을 더 배치해 오전 중에 마무리합니다.',
  '엘리베이터 사용 예약만 미리 해주시면 사다리차 비용이 빠집니다.',
] as const;

/** 요청 1건에 견적 3건 — 기사님 5명을 한 칸씩 밀어가며 배정해 중복을 피합니다. */
const paginationMoverIds = [
  MOVER.minjae,
  MOVER.seojun,
  MOVER.jihoon,
  MOVER.yuri,
  MOVER.haneul,
] as const;

const PAGINATION_REQUEST_COUNT = 10;
const ESTIMATES_PER_PAGINATION_REQUEST = 3;

const paginationRequests = Array.from(
  { length: PAGINATION_REQUEST_COUNT },
  (_unusedRequest, index) => {
    const route = paginationRoutes[index % paginationRoutes.length];
    // 짝수는 확정까지 간 요청(확정견적 1 + 탈락 2), 홀수는 확정 없이 만료된 요청입니다.
    const isCompleted = index % 2 === 0;

    return {
      id: seqId(REQUEST_ID_PREFIX, LAST_REQUEST_SEQUENCE + index + 1),
      customerId: CUSTOMER.jimin,
      serviceType: route.serviceType,
      moveDate: days(-31 - index * 5),
      // createdAt이 겹치면 커서 정렬이 흔들리므로 요청마다 5일씩 벌립니다.
      createdAt: days(-45 - index * 5),
      status: (isCompleted ? 'COMPLETED' : 'EXPIRED') as EstimateRequestStatus,
      departureZipCode: route.departureZipCode,
      departureAddress: route.departureAddress,
      arrivalZipCode: route.arrivalZipCode,
      arrivalAddress: route.arrivalAddress,
      estimates: Array.from(
        { length: ESTIMATES_PER_PAGINATION_REQUEST },
        (_unusedEstimate, position) => ({
          id: seqId(
            ESTIMATE_ID_PREFIX,
            LAST_ESTIMATE_SEQUENCE +
              index * ESTIMATES_PER_PAGINATION_REQUEST +
              position +
              1
          ),
          moverId:
            paginationMoverIds[(index + position) % paginationMoverIds.length],
          price: 240000 + index * 20000 + position * 30000,
          comment:
            paginationComments[(index + position) % paginationComments.length],
          // 세 요청에 한 번꼴로 첫 견적만 지정 견적으로 시작한 건입니다.
          isDesignated: position === 0 && index % 3 === 0,
          status: (isCompleted
            ? position === 0
              ? 'ACCEPTED'
              : 'NOT_SELECTED'
            : 'EXPIRED') as EstimateStatus,
          rejectReason: null,
          createdAt: days(-44 - index * 5),
        })
      ),
    };
  }
);

// ---------------------------------------------------------------------------
// 4-3. 리뷰 페이지네이션 확인용 — 완료된 이사 내역 (시연용 일반회원 ↔ 시연용 기사회원)
//    GET /review/me 는 hasReview=true(작성 완료) / false(작성 대기) 목록이 따로 있고
//    GET /review/mover/:moverId 도 pageSize가 10이라, 한 기사님에게 리뷰가 11건 넘게
//    쌓여야 2페이지를 확인할 수 있습니다.
//    확정 견적을 시연용 기사회원에게 몰아주면 두 목록을 한 벌의 데이터로 채울 수 있고,
//    시연 계정으로 로그인했을 때 이사 내역·리뷰 화면이 비어 있지 않습니다.
//    (기사님 리뷰 목록 응답에는 작성자 정보가 없어 작성자가 한 명이어도 무방합니다.)
// ---------------------------------------------------------------------------

/** 리뷰 목록 페이지네이션용 완료 요청 수 — 절반만 리뷰를 달아 두 탭을 모두 채웁니다. */
const REVIEW_PAGINATION_REQUEST_COUNT = 24;

/** 확정 견적을 몰아줄 기사님 — 이 기사님의 리뷰 목록이 2페이지 이상이 됩니다. */
const REVIEW_PAGINATION_MOVER_ID = DEMO.mover;

/** 위 완료 내역·찜·알림의 주인 — 시연 계정 하나로 모든 목록이 채워집니다. */
const REVIEW_PAGINATION_CUSTOMER_ID = DEMO.customer;

/** 4-2 블록이 쓴 마지막 순번 뒤에서 이어 붙입니다. */
const REVIEW_REQUEST_START_SEQUENCE =
  LAST_REQUEST_SEQUENCE + PAGINATION_REQUEST_COUNT;
const REVIEW_ESTIMATE_START_SEQUENCE =
  LAST_ESTIMATE_SEQUENCE +
  PAGINATION_REQUEST_COUNT * ESTIMATES_PER_PAGINATION_REQUEST;

const reviewContents = [
  '약속한 시간보다 먼저 도착해 준비해 주셨어요. 짐 정리까지 도와주셔서 편했습니다.',
  '견적서 금액 그대로 받으셨습니다. 추가 요금 이야기가 전혀 없어 좋았어요.',
  '엘리베이터가 없는 건물이었는데도 불평 없이 끝까지 해주셨습니다.',
  '가전 포장을 꼼꼼히 해주셔서 흠집 하나 없었어요. 다음에도 부탁드릴게요.',
  '작업자분들이 친절하셨고 마무리 청소까지 해주셨습니다.',
  '비 오는 날이었는데 바닥 보양을 미리 해주셔서 집이 깨끗했어요.',
] as const;

const reviewPaginationRequests = Array.from(
  { length: REVIEW_PAGINATION_REQUEST_COUNT },
  (_unusedRequest, index) => {
    const route = paginationRoutes[index % paginationRoutes.length];

    return {
      id: seqId(REQUEST_ID_PREFIX, REVIEW_REQUEST_START_SEQUENCE + index + 1),
      customerId: REVIEW_PAGINATION_CUSTOMER_ID,
      serviceType: route.serviceType,
      // 4-2 블록(-31일 ~ -76일)과 겹치지 않도록 더 과거에 배치합니다.
      moveDate: days(-200 - index * 3),
      createdAt: days(-215 - index * 3),
      status: 'COMPLETED' as EstimateRequestStatus,
      departureZipCode: route.departureZipCode,
      departureAddress: route.departureAddress,
      arrivalZipCode: route.arrivalZipCode,
      arrivalAddress: route.arrivalAddress,
      estimates: [
        {
          id: seqId(
            ESTIMATE_ID_PREFIX,
            REVIEW_ESTIMATE_START_SEQUENCE + index + 1
          ),
          moverId: REVIEW_PAGINATION_MOVER_ID,
          price: 300000 + index * 10000,
          comment: paginationComments[index % paginationComments.length],
          // 작성 가능한 리뷰에서 지정 견적 태그를 보려면 리뷰 없는 건 1개가 필요하다.
          // index 1은 리뷰를 달지 않는 홀수라, 목록 맨 앞에 지정 요청으로 나온다.
          isDesignated: index === 1,
          status: 'ACCEPTED' as EstimateStatus,
          rejectReason: null,
          createdAt: days(-214 - index * 3),
        },
      ],
    };
  }
);

/** 짝수 번째 요청에만 리뷰를 답니다 — 작성 완료 12건 / 작성 대기 12건. */
const reviewPaginationReviews = reviewPaginationRequests
  .filter((_unusedRequest, index) => index % 2 === 0)
  .map((request, position) => ({
    estimateId: request.estimates[0].id,
    customerId: REVIEW_PAGINATION_CUSTOMER_ID,
    moverId: REVIEW_PAGINATION_MOVER_ID,
    // 평점 3~5를 돌려 써서 기사님 상세의 평점 분포도 함께 확인됩니다.
    rating: 3 + (position % 3),
    content: reviewContents[position % reviewContents.length],
    createdAt: days(-210 - position * 6),
  }));

// ---------------------------------------------------------------------------
// 4-4. 3-1에서 만든 일반 유저의 완료된 이사 — 유저 1명당 확정 견적 1건입니다.
//    확정 기사님을 한 칸씩 밀어 배정해 리뷰·평점이 여러 기사님에게 흩어집니다.
//    이게 없으면 신규 기사님 전원이 리뷰 0건이라 sortBy=reviewCount / rating
//    결과가 전부 동률로 나옵니다.
// ---------------------------------------------------------------------------

/** 4-3 블록이 쓴 마지막 순번 뒤에서 이어 붙입니다. */
const CUSTOMER_REQUEST_START_SEQUENCE =
  REVIEW_REQUEST_START_SEQUENCE + REVIEW_PAGINATION_REQUEST_COUNT;
const CUSTOMER_ESTIMATE_START_SEQUENCE =
  REVIEW_ESTIMATE_START_SEQUENCE + REVIEW_PAGINATION_REQUEST_COUNT;

const customerPaginationRequests = paginationCustomers.map(
  (customer, index) => {
    const route = paginationRoutes[index % paginationRoutes.length];
    // 고정 기사님 5명에게 쏠리지 않도록 allMovers 전체를 돌며 배정합니다.
    const mover = allMovers[(index + 1) % allMovers.length];

    return {
      id: seqId(REQUEST_ID_PREFIX, CUSTOMER_REQUEST_START_SEQUENCE + index + 1),
      customerId: customer.id,
      serviceType: route.serviceType,
      moveDate: days(-40 - index * 4),
      createdAt: days(-55 - index * 4),
      status: 'COMPLETED' as EstimateRequestStatus,
      departureZipCode: route.departureZipCode,
      departureAddress: route.departureAddress,
      arrivalZipCode: route.arrivalZipCode,
      arrivalAddress: route.arrivalAddress,
      estimates: [
        {
          id: seqId(
            ESTIMATE_ID_PREFIX,
            CUSTOMER_ESTIMATE_START_SEQUENCE + index + 1
          ),
          moverId: mover.id,
          price: 280000 + index * 15000,
          comment: paginationComments[index % paginationComments.length],
          isDesignated: false,
          status: 'ACCEPTED' as EstimateStatus,
          rejectReason: null,
          createdAt: days(-54 - index * 4),
        },
      ],
    };
  }
);

/** 4명 중 3명이 리뷰를 남긴 상태 — 기사님별 리뷰 수·평점이 서로 달라집니다. */
const customerPaginationReviews = customerPaginationRequests
  .filter((_unusedRequest, index) => index % 4 !== 3)
  .map((request, position) => ({
    estimateId: request.estimates[0].id,
    customerId: request.customerId,
    moverId: request.estimates[0].moverId,
    rating: 3 + (position % 3),
    content: reviewContents[position % reviewContents.length],
    createdAt: days(-35 - position * 2),
  }));

// ---------------------------------------------------------------------------
// 4-5. 시연용 일반회원의 진행 중 견적 요청
//    "대기 중인 견적" 화면에 상태가 한 번에 보이도록 구성합니다.
//    - DESIGNATED        : 시연용 기사회원에게 보낸 지정 요청 (기사님 응답 전)
//                          → 시연용 기사회원의 "받은 요청"에도 지정 건으로 뜹니다.
//    - PROPOSED + 지정   : 지정 요청에 기사님이 금액을 보낸 견적 (확정 가능)
//    - PROPOSED          : 지정 없이 도착한 견적 (확정 가능)
//    - REJECTED          : 기사님이 반려한 지정 요청
//    지정 견적은 요청당 3건이라 이 요청은 상한까지 차 있습니다.
//    여기서 지정 견적을 한 건 더 보내면 409가 납니다.
// ---------------------------------------------------------------------------

const demoActiveRequest = {
  id: DEMO.request,
  customerId: DEMO.customer,
  serviceType: 'SMALL_MOVE' as const,
  moveDate: days(9),
  createdAt: days(-2),
  status: 'PENDING' as EstimateRequestStatus,
  departureZipCode: '04524',
  departureAddress: '서울특별시 중구 세종대로 110 1203호',
  arrivalZipCode: '13529',
  arrivalAddress: '경기도 성남시 분당구 판교역로 235 102동 1503호',
  estimates: [
    {
      id: DEMO.designatedEstimate,
      moverId: DEMO.mover,
      price: null,
      comment: null,
      isDesignated: true,
      status: 'DESIGNATED' as EstimateStatus,
      rejectReason: null,
      createdAt: days(-2),
    },
    {
      id: DEMO.proposedEstimate1,
      moverId: MOVER.minjae,
      price: 390000,
      comment:
        '지정 요청 기준으로 2.5톤 차량 1대, 작업자 2명입니다. 엘리베이터가 있어 사다리차는 필요 없습니다.',
      isDesignated: true,
      status: 'PROPOSED' as EstimateStatus,
      rejectReason: null,
      createdAt: days(-1),
    },
    {
      id: DEMO.proposedEstimate2,
      moverId: MOVER.haneul,
      price: 445000,
      comment:
        '포장자재와 정리 인력 1명이 포함된 금액입니다. 전 과정을 사진으로 남겨 드립니다.',
      isDesignated: false,
      status: 'PROPOSED' as EstimateStatus,
      rejectReason: null,
      createdAt: days(-1),
    },
    {
      id: DEMO.rejectedEstimate,
      moverId: MOVER.seojun,
      price: null,
      comment: null,
      isDesignated: true,
      status: 'REJECTED' as EstimateStatus,
      rejectReason:
        '요청하신 날짜에 이미 예약된 일정이 있어 부득이하게 반려합니다. 다른 날짜는 상담 가능합니다.',
      createdAt: days(-2),
    },
  ],
};

/*
@ 시연 일반회원 이사 내역 — 만료
- GET /estimate-requests/history 와 GET /estimates?status=closed 는
  COMPLETED뿐 아니라 EXPIRED도 보여 준다. 4-3은 완료만 있어 만료 카드가 없었다.
- 견적은 시연 기사님 앞으로 둬서 GET /estimates?status=EXPIRED 도 비지 않는다.
*/
const DEMO_EXPIRED_REQUEST_COUNT = 3;

const DEMO_CLOSED_REQUEST_START_SEQUENCE =
  CUSTOMER_REQUEST_START_SEQUENCE + EXTRA_CUSTOMER_COUNT;
const DEMO_CLOSED_ESTIMATE_START_SEQUENCE =
  CUSTOMER_ESTIMATE_START_SEQUENCE + EXTRA_CUSTOMER_COUNT;

const demoExpiredRequests = Array.from(
  { length: DEMO_EXPIRED_REQUEST_COUNT },
  (_unusedRequest, index) => {
    const route = paginationRoutes[index % paginationRoutes.length];

    return {
      id: seqId(
        REQUEST_ID_PREFIX,
        DEMO_CLOSED_REQUEST_START_SEQUENCE + index + 1
      ),
      customerId: DEMO.customer,
      serviceType: route.serviceType,
      moveDate: days(-6 - index * 5),
      createdAt: days(-12 - index * 5),
      status: 'EXPIRED' as EstimateRequestStatus,
      departureZipCode: route.departureZipCode,
      departureAddress: route.departureAddress,
      arrivalZipCode: route.arrivalZipCode,
      arrivalAddress: route.arrivalAddress,
      estimates: [
        {
          id: seqId(
            ESTIMATE_ID_PREFIX,
            DEMO_CLOSED_ESTIMATE_START_SEQUENCE + index + 1
          ),
          moverId: DEMO.mover,
          price: 330000 + index * 20000,
          comment: paginationComments[index % paginationComments.length],
          isDesignated: index === 0,
          status: 'EXPIRED' as EstimateStatus,
          rejectReason: null,
          createdAt: days(-11 - index * 5),
        },
        ...(index === 0
          ? [
              {
                id: seqId(
                  ESTIMATE_ID_PREFIX,
                  DEMO_CLOSED_ESTIMATE_START_SEQUENCE +
                    DEMO_EXPIRED_REQUEST_COUNT +
                    1
                ),
                moverId: MOVER.minjae,
                price: 360000,
                comment: paginationComments[1],
                isDesignated: false,
                status: 'EXPIRED' as EstimateStatus,
                rejectReason: null,
                createdAt: days(-11),
              },
            ]
          : []),
      ],
    };
  }
);

/** 완료 내역 3건에 탈락 견적을 붙여 받았던 견적에 NOT_SELECTED가 보이게 한다. */
const lostMoverIds = [MOVER.minjae, MOVER.haneul, MOVER.seojun] as const;

reviewPaginationRequests
  .slice(0, lostMoverIds.length)
  .forEach((request, index) => {
    request.estimates.push({
      id: seqId(
        ESTIMATE_ID_PREFIX,
        DEMO_CLOSED_ESTIMATE_START_SEQUENCE +
          DEMO_EXPIRED_REQUEST_COUNT +
          2 +
          index
      ),
      moverId: lostMoverIds[index],
      price: request.estimates[0].price + 50000,
      comment: paginationComments[(index + 1) % paginationComments.length],
      isDesignated: false,
      status: 'NOT_SELECTED' as EstimateStatus,
      rejectReason: null,
      createdAt: request.estimates[0].createdAt,
    });
  });

/** 위 고정 픽스처 + 페이지네이션용 데이터 + 시연용 데이터 */
const allEstimateRequests = [
  ...estimateRequests,
  ...paginationRequests,
  ...reviewPaginationRequests,
  ...customerPaginationRequests,
  ...demoExpiredRequests,
  demoActiveRequest,
];

async function seedEstimateRequests() {
  for (const request of allEstimateRequests) {
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
    { customerId: DEMO.customer, requestId: DEMO.request },
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
// 4-1. 받은 요청 목록 확인용 데이터 (GET /estimate-requests/received)
// ---------------------------------------------------------------------------

/*
@ 설계 의도

- moveDate(이사일)와 createdAt(요청일) 순서를 일부러 엇갈리게 배치했습니다.
  sortBy=moveDate 와 sortBy=createdAt 의 결과가 눈으로 구분됩니다.
- 지역·서비스를 흩뿌려 regions / serviceTypes 필터가 각각 다른 건수를 냅니다.
- 이름에 김/이/박 성씨를 섞어 keyword 검색을 확인할 수 있습니다.
- designatedTo 가 있으면 그 기사님에게 지정 견적(DESIGNATED)을 하나 답니다.
  parkBusan 은 정하늘의 서비스 지역(수도권) 밖인데 정하늘에게 지정했습니다.
  "지정 견적은 서비스·지역과 무관하게 보인다"는 규칙을 확인하는 케이스입니다.

@ 정렬 결과 (정하늘 기준)

  이사일 빠른순 : 이경기 → 김서울 → 김인천 → 박부산 → 김경기 → 박대전 → 이서울
  요청일 빠른순 : 김경기 → 이경기 → 박부산 → 김인천 → 박대전 → 이서울 → 김서울
*/
const receivedFixtures = [
  {
    customerId: RECEIVED_CUSTOMER.kimSeoul,
    requestId: RECEIVED_REQUEST.kimSeoul,
    name: '김서울',
    email: 'kim.seoul@example.com',
    phoneNumber: '01077770001',
    region: 'SEOUL',
    serviceType: 'SMALL_MOVE',
    moveDate: days(4),
    createdAt: days(-1),
    departureAddress: '서울특별시 마포구 양화로 45 302호',
    arrivalAddress: '서울특별시 성동구 왕십리로 222 1104호',
    designatedTo: null,
  },
  {
    customerId: RECEIVED_CUSTOMER.kimGyeonggi,
    requestId: RECEIVED_REQUEST.kimGyeonggi,
    name: '김경기',
    email: 'kim.gyeonggi@example.com',
    phoneNumber: '01077770002',
    region: 'GYEONGGI',
    serviceType: 'HOME_MOVE',
    moveDate: days(11),
    createdAt: days(-9),
    departureAddress: '경기도 용인시 수지구 풍덕천로 100 203동 501호',
    arrivalAddress: '경기도 화성시 동탄대로 500 105동 1203호',
    designatedTo: MOVER.haneul,
  },
  {
    customerId: RECEIVED_CUSTOMER.kimIncheon,
    requestId: RECEIVED_REQUEST.kimIncheon,
    name: '김인천',
    email: 'kim.incheon@example.com',
    phoneNumber: '01077770003',
    region: 'INCHEON',
    serviceType: 'OFFICE_MOVE',
    moveDate: days(6),
    createdAt: days(-5),
    departureAddress: '인천광역시 연수구 컨벤시아대로 165 7층',
    arrivalAddress: '인천광역시 서구 청라커낼로 250 4층',
    designatedTo: null,
  },
  {
    customerId: RECEIVED_CUSTOMER.leeSeoul,
    requestId: RECEIVED_REQUEST.leeSeoul,
    name: '이서울',
    email: 'lee.seoul@example.com',
    phoneNumber: '01077770004',
    region: 'SEOUL',
    serviceType: 'HOME_MOVE',
    moveDate: days(18),
    createdAt: days(-2),
    departureAddress: '서울특별시 노원구 동일로 1234 505동 802호',
    arrivalAddress: '서울특별시 송파구 올림픽로 300 21층',
    designatedTo: null,
  },
  {
    customerId: RECEIVED_CUSTOMER.leeGyeonggi,
    requestId: RECEIVED_REQUEST.leeGyeonggi,
    name: '이경기',
    email: 'lee.gyeonggi@example.com',
    phoneNumber: '01077770005',
    region: 'GYEONGGI',
    serviceType: 'SMALL_MOVE',
    moveDate: days(2),
    createdAt: days(-7),
    departureAddress: '경기도 고양시 일산동구 중앙로 1275 401호',
    arrivalAddress: '경기도 파주시 심학산로 300 102동 703호',
    designatedTo: null,
  },
  {
    customerId: RECEIVED_CUSTOMER.parkIncheon,
    requestId: RECEIVED_REQUEST.parkIncheon,
    name: '박인천',
    email: 'park.incheon@example.com',
    phoneNumber: '01077770006',
    region: 'INCHEON',
    serviceType: 'SMALL_MOVE',
    moveDate: days(25),
    createdAt: days(-3),
    departureAddress: '인천광역시 부평구 부평대로 168 1502호',
    arrivalAddress: '인천광역시 미추홀구 인하로 100 301호',
    designatedTo: MOVER.minjae,
  },
  {
    // 정하늘의 서비스 지역(수도권) 밖이지만 정하늘에게 지정한 요청
    customerId: RECEIVED_CUSTOMER.parkBusan,
    requestId: RECEIVED_REQUEST.parkBusan,
    name: '박부산',
    email: 'park.busan@example.com',
    phoneNumber: '01077770007',
    region: 'BUSAN',
    serviceType: 'SMALL_MOVE',
    moveDate: days(8),
    createdAt: days(-6),
    departureAddress: '부산광역시 수영구 광안해변로 219 1801호',
    arrivalAddress: '부산광역시 동래구 충렬대로 120 604호',
    designatedTo: MOVER.haneul,
  },
  {
    // 어느 기사님의 서비스 지역에도 없고 지정도 아닌 요청 — 목록에 뜨면 안 됩니다.
    customerId: RECEIVED_CUSTOMER.parkDaejeon,
    requestId: RECEIVED_REQUEST.parkDaejeon,
    name: '박대전',
    email: 'park.daejeon@example.com',
    phoneNumber: '01077770008',
    region: 'DAEJEON',
    serviceType: 'HOME_MOVE',
    moveDate: days(13),
    createdAt: days(-4),
    departureAddress: '대전광역시 중구 계룡로 800 1205호',
    arrivalAddress: '대전광역시 대덕구 계족로 400 302호',
    designatedTo: null,
  },
] as const;

// ---------------------------------------------------------------------------
// 4-1-1. 받은 요청 목록 페이지네이션 확인용 — 기본 size가 10이라 고정 8건으로는
//    nextCursor가 내려오지 않습니다. 수도권 요청 8건을 더 만듭니다.
//    진행 중(PENDING) 요청은 고객당 1건만 가능해 요청 수만큼 고객도 함께 만듭니다.
//    주소·서비스는 4-2의 paginationRoutes를 그대로 재사용합니다.
// ---------------------------------------------------------------------------

/** 고정 픽스처가 쓴 마지막 순번 — 추가 고객/요청은 여기서 이어 붙입니다. */
const LAST_RECEIVED_SEQUENCE = 8;

const EXTRA_RECEIVED_COUNT = 8;

/** keyword 검색 확인을 위해 성씨를 섞습니다. */
const extraReceivedNames = [
  '김하준',
  '이서아',
  '박도윤',
  '최지우',
  '김민석',
  '이예린',
  '박시원',
  '최나현',
] as const;

/** paginationRoutes의 주소가 속한 지역 — 요청 지역과 주소를 맞춥니다. */
const paginationRouteRegions = [
  'SEOUL',
  'SEOUL',
  'SEOUL',
  'GYEONGGI',
  'INCHEON',
] as const;

const paginationReceivedFixtures = Array.from(
  { length: EXTRA_RECEIVED_COUNT },
  (_unusedFixture, index) => {
    const sequence = LAST_RECEIVED_SEQUENCE + index + 1;
    const routeIndex = index % paginationRoutes.length;
    const route = paginationRoutes[routeIndex];

    return {
      customerId: seqId(RECEIVED_CUSTOMER_ID_PREFIX, sequence),
      requestId: seqId(RECEIVED_REQUEST_ID_PREFIX, sequence),
      name: extraReceivedNames[index],
      email: `received${sequence}@example.com`,
      phoneNumber: `0107778${String(sequence).padStart(4, '0')}`,
      region: paginationRouteRegions[routeIndex],
      serviceType: route.serviceType,
      // 이사일과 요청일 순서를 엇갈리게 둬서 sortBy 두 값의 결과가 달라집니다.
      moveDate: days(30 + index * 2),
      createdAt: days(-10 - (EXTRA_RECEIVED_COUNT - index)),
      departureAddress: route.departureAddress,
      arrivalAddress: route.arrivalAddress,
      designatedTo: null,
    };
  }
);

/*
@ 시연 기사님(mover@demo.kr) 지정 견적
- 받은 요청 화면 기본 필터가 "지정 견적 요청만"이고 기본 size가 10이라,
  시연 고객이 보낸 1건과 합쳐 11건이 넘어야 다음 페이지가 생깁니다.
- 수도권 건은 기본 화면(지정 + 서비스 가능 지역)에 바로 보입니다.
- 부산 1건은 서비스 지역 밖 지정 — "서비스 가능 지역" 체크를 끄면 나타납니다.
*/
const demoDesignatedFixtures = [
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 1),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 1),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 1),
    name: '윤서아',
    email: 'demo.designated1@example.com',
    phoneNumber: '01066660001',
    region: 'SEOUL',
    serviceType: 'SMALL_MOVE',
    moveDate: days(5),
    createdAt: days(-1),
    departureAddress: '서울특별시 강남구 테헤란로 152 1601호',
    arrivalAddress: '서울특별시 마포구 월드컵북로 396 802호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 2),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 2),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 2),
    name: '한지우',
    email: 'demo.designated2@example.com',
    phoneNumber: '01066660002',
    region: 'GYEONGGI',
    serviceType: 'HOME_MOVE',
    moveDate: days(10),
    createdAt: days(-4),
    departureAddress: '경기도 성남시 분당구 판교역로 166 101동 1203호',
    arrivalAddress: '경기도 용인시 수지구 죽전로 152 203동 501호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 3),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 3),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 3),
    name: '오세린',
    email: 'demo.designated3@example.com',
    phoneNumber: '01066660003',
    region: 'INCHEON',
    serviceType: 'OFFICE_MOVE',
    moveDate: days(15),
    createdAt: days(-3),
    departureAddress: '인천광역시 연수구 컨벤시아대로 165 7층',
    arrivalAddress: '인천광역시 서구 청라커낼로 250 4층',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 4),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 4),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 4),
    name: '장도윤',
    email: 'demo.designated4@example.com',
    phoneNumber: '01066660004',
    region: 'SEOUL',
    serviceType: 'HOME_MOVE',
    moveDate: days(21),
    createdAt: days(-6),
    departureAddress: '서울특별시 송파구 올림픽로 300 21층',
    arrivalAddress: '서울특별시 노원구 동일로 1234 505동 802호',
    designatedTo: DEMO.mover,
  },
  {
    // 시연 기사님 서비스 지역(수도권) 밖 지정 — 지역 필터를 끄면 보입니다.
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 5),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 5),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 5),
    name: '신태양',
    email: 'demo.designated5@example.com',
    phoneNumber: '01066660005',
    region: 'BUSAN',
    serviceType: 'SMALL_MOVE',
    moveDate: days(8),
    createdAt: days(-2),
    departureAddress: '부산광역시 해운대구 해운대해변로 264 1203호',
    arrivalAddress: '부산광역시 수영구 광안해변로 219 1801호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 6),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 6),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 6),
    name: '권하준',
    email: 'demo.designated6@example.com',
    phoneNumber: '01066660006',
    region: 'SEOUL',
    serviceType: 'SMALL_MOVE',
    moveDate: days(3),
    createdAt: days(-11),
    departureAddress: '서울특별시 마포구 양화로 45 302호',
    arrivalAddress: '서울특별시 성동구 왕십리로 222 1104호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 7),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 7),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 7),
    name: '황서윤',
    email: 'demo.designated7@example.com',
    phoneNumber: '01066660007',
    region: 'GYEONGGI',
    serviceType: 'HOME_MOVE',
    moveDate: days(13),
    createdAt: days(-12),
    departureAddress: '경기도 용인시 수지구 풍덕천로 100 203동 501호',
    arrivalAddress: '경기도 화성시 동탄대로 500 105동 1203호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 8),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 8),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 8),
    name: '안지호',
    email: 'demo.designated8@example.com',
    phoneNumber: '01066660008',
    region: 'INCHEON',
    serviceType: 'SMALL_MOVE',
    moveDate: days(17),
    createdAt: days(-13),
    departureAddress: '인천광역시 부평구 부평대로 168 1502호',
    arrivalAddress: '인천광역시 미추홀구 인하로 100 301호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 9),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 9),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 9),
    name: '송예나',
    email: 'demo.designated9@example.com',
    phoneNumber: '01066660009',
    region: 'SEOUL',
    serviceType: 'OFFICE_MOVE',
    moveDate: days(20),
    createdAt: days(-14),
    departureAddress: '서울특별시 중구 남대문로 63 8층',
    arrivalAddress: '서울특별시 강남구 가로수길 43 2층',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 10),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 10),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 10),
    name: '전민재',
    email: 'demo.designated10@example.com',
    phoneNumber: '01066660010',
    region: 'GYEONGGI',
    serviceType: 'SMALL_MOVE',
    moveDate: days(26),
    createdAt: days(-15),
    departureAddress: '경기도 고양시 일산동구 중앙로 1275 401호',
    arrivalAddress: '경기도 파주시 심학산로 300 102동 703호',
    designatedTo: DEMO.mover,
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 15),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 15),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 15),
    name: '홍수빈',
    email: 'demo.designated11@example.com',
    phoneNumber: '01066660011',
    region: 'INCHEON',
    serviceType: 'HOME_MOVE',
    moveDate: days(28),
    createdAt: days(-16),
    departureAddress: '인천광역시 남동구 예술로 149 201동 1102호',
    arrivalAddress: '인천광역시 중구 영종대로 106 508호',
    designatedTo: DEMO.mover,
  },
] as const;

/** 고정 픽스처 + 페이지네이션용 데이터 + 시연 기사님 지정 견적 */
const allReceivedFixtures = [
  ...receivedFixtures,
  ...paginationReceivedFixtures,
  ...demoDesignatedFixtures,
];

async function seedReceivedFixtures() {
  for (const fixture of allReceivedFixtures) {
    await prisma.user.create({
      data: {
        id: fixture.customerId,
        name: fixture.name,
        email: fixture.email,
        phoneNumber: fixture.phoneNumber,
        password: getSeedPasswordHash(),
        role: 'CUSTOMER',
        provider: 'LOCAL',
        customerProfile: {
          create: {
            region: fixture.region,
            serviceTypes: { create: [{ serviceType: fixture.serviceType }] },
          },
        },
      },
    });

    await prisma.estimateRequest.create({
      data: {
        id: fixture.requestId,
        customerId: fixture.customerId,
        serviceType: fixture.serviceType,
        moveDate: fixture.moveDate,
        createdAt: fixture.createdAt,
        status: 'PENDING',
        departureZipCode: '04524',
        departureAddress: fixture.departureAddress,
        arrivalZipCode: '06236',
        arrivalAddress: fixture.arrivalAddress,
        // 지정 견적은 금액 없이 DESIGNATED 상태로 만듭니다(기사님 응답 전).
        ...(fixture.designatedTo
          ? {
              estimates: {
                create: [
                  {
                    ...('estimateId' in fixture
                      ? { id: fixture.estimateId }
                      : {}),
                    moverId: fixture.designatedTo,
                    isDesignated: true,
                    status: 'DESIGNATED',
                    createdAt: fixture.createdAt,
                  },
                ],
              },
            }
          : {}),
      },
    });

    // PENDING 요청은 고객의 활성 요청으로 연결합니다.
    await prisma.customerProfile.update({
      where: { userId: fixture.customerId },
      data: { activeEstimateRequestId: fixture.requestId },
    });
  }
}

// ---------------------------------------------------------------------------
// 4-1-2. 시연 기사님 반려 요청 (GET /estimates?status=REJECTED)
//    같은 요청에 DESIGNATED와 REJECTED를 같이 달 수 없어(견적 unique:
//    estimateRequestId + moverId) 고객을 따로 만듭니다.
// ---------------------------------------------------------------------------

const demoRejectedFixtures = [
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 11),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 11),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 11),
    name: '문가은',
    email: 'demo.rejected1@example.com',
    phoneNumber: '01055550001',
    region: 'SEOUL',
    serviceType: 'SMALL_MOVE' as const,
    moveDate: days(7),
    createdAt: days(-5),
    departureAddress: '서울특별시 중구 세종대로 110 3층',
    arrivalAddress: '서울특별시 강남구 가로수길 5 201호',
    rejectReason: '해당 날짜에 이미 확정된 이사 일정이 있어 어렵습니다.',
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 12),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 12),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 12),
    name: '배진아',
    email: 'demo.rejected2@example.com',
    phoneNumber: '01055550002',
    region: 'GYEONGGI',
    serviceType: 'HOME_MOVE' as const,
    moveDate: days(12),
    createdAt: days(-8),
    departureAddress: '경기도 고양시 일산동구 중앙로 1275 401호',
    arrivalAddress: '경기도 파주시 심학산로 300 102동 703호',
    rejectReason: '출발지 주정차가 어려워 이번 건은 진행이 어렵습니다.',
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 13),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 13),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 13),
    name: '서하린',
    email: 'demo.rejected3@example.com',
    phoneNumber: '01055550003',
    region: 'INCHEON',
    serviceType: 'OFFICE_MOVE' as const,
    moveDate: days(18),
    createdAt: days(-3),
    departureAddress: '인천광역시 남동구 예술로 149 8층',
    arrivalAddress: '인천광역시 연수구 송도과학로 32 12층',
    rejectReason: '사무실 이전 인력 일정이 겹쳐 요청하신 날짜는 어렵습니다.',
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 14),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 14),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 14),
    name: '최나현',
    email: 'demo.rejected4@example.com',
    phoneNumber: '01055550004',
    region: 'SEOUL',
    serviceType: 'HOME_MOVE' as const,
    moveDate: days(24),
    createdAt: days(-6),
    departureAddress: '서울특별시 서대문구 연희로 25 401호',
    arrivalAddress: '서울특별시 성동구 왕십리로 222 1104호',
    rejectReason: '고층 사다리차 예약이 어려워 해당 일정은 진행할 수 없습니다.',
  },
] as const;

async function seedDemoRejectedFixtures() {
  for (const fixture of demoRejectedFixtures) {
    await prisma.user.create({
      data: {
        id: fixture.customerId,
        name: fixture.name,
        email: fixture.email,
        phoneNumber: fixture.phoneNumber,
        password: getSeedPasswordHash(),
        role: 'CUSTOMER',
        provider: 'LOCAL',
        customerProfile: {
          create: {
            region: fixture.region,
            serviceTypes: { create: [{ serviceType: fixture.serviceType }] },
          },
        },
      },
    });

    await prisma.estimateRequest.create({
      data: {
        id: fixture.requestId,
        customerId: fixture.customerId,
        serviceType: fixture.serviceType,
        moveDate: fixture.moveDate,
        createdAt: fixture.createdAt,
        status: 'PENDING',
        departureZipCode: '06236',
        departureAddress: fixture.departureAddress,
        arrivalZipCode: '03923',
        arrivalAddress: fixture.arrivalAddress,
        estimates: {
          create: [
            {
              id: fixture.estimateId,
              moverId: DEMO.mover,
              isDesignated: true,
              status: 'REJECTED',
              rejectReason: fixture.rejectReason,
              createdAt: fixture.createdAt,
            },
          ],
        },
      },
    });

    await prisma.customerProfile.update({
      where: { userId: fixture.customerId },
      data: { activeEstimateRequestId: fixture.requestId },
    });
  }
}

// ---------------------------------------------------------------------------
// 4-1-4. 시연 기사님 보낸 견적 — 이사 완료가 아닌 건
//    GET /estimates?status=PROPOSED,ACCEPTED,NOT_SELECTED
//    4-3 블록은 전부 과거 이사(COMPLETED)라 보낸 견적 조회에 완료 카드만 보입니다.
//    PENDING / CONFIRMED 는 고객당 1건이라 고객을 따로 만듭니다.
//    이사일은 오늘 이후여야 마감 잡이 COMPLETED / EXPIRED 로 바꾸지 않습니다.
// ---------------------------------------------------------------------------

const demoSentFixtures = [
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 21),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 21),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 21),
    name: '강민서',
    email: 'demo.sent1@example.com',
    phoneNumber: '01044440001',
    region: 'SEOUL' as const,
    serviceType: 'SMALL_MOVE' as const,
    moveDate: days(6),
    createdAt: days(-1),
    departureAddress: '서울특별시 중구 세종대로 110 3층',
    arrivalAddress: '서울특별시 강남구 가로수길 5 201호',
    requestStatus: 'PENDING' as const,
    estimateStatus: 'PROPOSED' as const,
    isDesignated: false,
    price: 320000,
    comment:
      '원룸 기준 2.5톤 차량 1대로 진행합니다. 엘리베이터가 있어 사다리차는 필요 없습니다.',
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 22),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 22),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 22),
    name: '노유진',
    email: 'demo.sent2@example.com',
    phoneNumber: '01044440002',
    region: 'GYEONGGI' as const,
    serviceType: 'HOME_MOVE' as const,
    moveDate: days(11),
    createdAt: days(-2),
    departureAddress: '경기도 성남시 분당구 판교역로 235 102동 1503호',
    arrivalAddress: '경기도 수원시 영통구 광교중앙로 145 305동 802호',
    requestStatus: 'PENDING' as const,
    estimateStatus: 'PROPOSED' as const,
    isDesignated: true,
    price: 780000,
    comment: '지정 요청 기준으로 쓰리룸, 작업자 3명으로 진행합니다.',
  },
  {
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 23),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 23),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 23),
    name: '임하늘',
    email: 'demo.sent3@example.com',
    phoneNumber: '01044440003',
    region: 'INCHEON' as const,
    serviceType: 'OFFICE_MOVE' as const,
    // 내일이어야 시연 기사님 MOVE_DAY 알림 문구(내일)와 이사일이 맞습니다.
    moveDate: days(1),
    createdAt: days(-4),
    departureAddress: '인천광역시 연수구 컨벤시아대로 165 7층',
    arrivalAddress: '인천광역시 서구 청라커낼로 250 4층',
    requestStatus: 'CONFIRMED' as const,
    estimateStatus: 'ACCEPTED' as const,
    isDesignated: false,
    price: 1450000,
    comment: '사무실 집기 분해·조립까지 포함한 금액입니다.',
  },
  {
    // 다른 기사님 견적이 확정되어 탈락. 이사일이 남아서 완료 오버레이 대상이 아닙니다.
    customerId: seqId(DEMO_CUSTOMER_ID_PREFIX, 24),
    requestId: seqId(DEMO_REQUEST_ID_PREFIX, 24),
    estimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 24),
    winnerEstimateId: seqId(DEMO_ESTIMATE_ID_PREFIX, 25),
    name: '조시우',
    email: 'demo.sent4@example.com',
    phoneNumber: '01044440004',
    region: 'SEOUL' as const,
    serviceType: 'HOME_MOVE' as const,
    moveDate: days(22),
    createdAt: days(-3),
    departureAddress: '서울특별시 송파구 올림픽로 300 21층',
    arrivalAddress: '서울특별시 노원구 동일로 1234 505동 802호',
    requestStatus: 'CONFIRMED' as const,
    estimateStatus: 'NOT_SELECTED' as const,
    isDesignated: false,
    price: 860000,
    comment: '가전 포장 포함, 작업자 3명 기준입니다.',
  },
] as const;

async function seedDemoSentEstimates() {
  for (const fixture of demoSentFixtures) {
    await prisma.user.create({
      data: {
        id: fixture.customerId,
        name: fixture.name,
        email: fixture.email,
        phoneNumber: fixture.phoneNumber,
        password: getSeedPasswordHash(),
        role: 'CUSTOMER',
        provider: 'LOCAL',
        customerProfile: {
          create: {
            region: fixture.region,
            serviceTypes: { create: [{ serviceType: fixture.serviceType }] },
          },
        },
      },
    });

    await prisma.estimateRequest.create({
      data: {
        id: fixture.requestId,
        customerId: fixture.customerId,
        serviceType: fixture.serviceType,
        moveDate: fixture.moveDate,
        createdAt: fixture.createdAt,
        status: fixture.requestStatus,
        departureZipCode: '04524',
        departureAddress: fixture.departureAddress,
        arrivalZipCode: '06236',
        arrivalAddress: fixture.arrivalAddress,
        estimates: {
          create: [
            {
              id: fixture.estimateId,
              moverId: DEMO.mover,
              price: fixture.price,
              comment: fixture.comment,
              isDesignated: fixture.isDesignated,
              status: fixture.estimateStatus,
              createdAt: fixture.createdAt,
            },
            ...('winnerEstimateId' in fixture
              ? [
                  {
                    id: fixture.winnerEstimateId,
                    moverId: MOVER.minjae,
                    price: fixture.price - 40000,
                    comment: '같은 일정으로 진행 가능합니다.',
                    isDesignated: false,
                    status: 'ACCEPTED' as const,
                    createdAt: fixture.createdAt,
                  },
                ]
              : []),
          ],
        },
      },
    });

    await prisma.customerProfile.update({
      where: { userId: fixture.customerId },
      data: { activeEstimateRequestId: fixture.requestId },
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

/** 고정 리뷰 + 4-3(한 기사님 몰아주기) + 4-4(여러 기사님에게 분산) */
const allReviews = [
  ...reviews,
  ...reviewPaginationReviews,
  ...customerPaginationReviews,
];

async function seedReviews() {
  await prisma.review.createMany({ data: allReviews });
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

/**
 * 찜한 기사님 목록(GET /like/me) 페이지네이션 확인용 — 기본 size가 10이라
 * 시연용 일반회원이 분량용 기사님 전원을 찜해 한 페이지를 넘깁니다.
 */
const paginationLikes = paginationMovers.map((mover) => ({
  customerId: DEMO.customer,
  moverId: mover.id,
}));

/** 시연용 일반회원은 시연용 기사회원도 찜해 둡니다. */
const demoLikes = [
  { customerId: DEMO.customer, moverId: DEMO.mover },
  { customerId: DEMO.customer, moverId: MOVER.minjae },
  { customerId: DEMO.customer, moverId: MOVER.haneul },
];

/**
 * 3-1의 일반 유저가 남기는 찜 — 유저 1명당 기사님 2명을 찜합니다.
 * 두 명을 이웃한 순번으로 골라야 (customerId, moverId) 유니크 제약에 걸리지 않습니다.
 * 보폭을 주면 기사님 수에 따라 두 값이 같아지는 지점이 생깁니다.
 */
const customerLikes = paginationCustomers.flatMap((customer, index) => [
  {
    customerId: customer.id,
    moverId: allMovers[(index * 2) % allMovers.length].id,
  },
  {
    customerId: customer.id,
    moverId: allMovers[(index * 2 + 1) % allMovers.length].id,
  },
]);

const allLikes = [...likes, ...paginationLikes, ...customerLikes, ...demoLikes];

async function seedLikes() {
  await prisma.like.createMany({ data: allLikes });
}

// ---------------------------------------------------------------------------
// 7. 알림
// ---------------------------------------------------------------------------

const notifications = [
  {
    userId: CUSTOMER.jimin,
    type: 'NEW_ESTIMATE',
    content: notificationMessage.newEstimate('김민재', 'SMALL_MOVE'),
    targetPath: ESTIMATE.jiminMinjae,
    isRead: false,
    createdAt: days(-2),
  },
  {
    userId: CUSTOMER.jimin,
    type: 'NEW_ESTIMATE',
    content: notificationMessage.newEstimate('정하늘', 'SMALL_MOVE'),
    targetPath: ESTIMATE.jiminHaneul,
    isRead: true,
    createdAt: days(-2),
  },
  {
    userId: MOVER.minjae,
    type: 'NEW_REQUEST',
    content: notificationMessage.newRequest('한지민', 'SMALL_MOVE'),
    isRead: true,
    createdAt: days(-3),
  },
  {
    userId: MOVER.seojun,
    type: 'NEW_REQUEST',
    content: notificationMessage.newRequest('한지민', 'SMALL_MOVE'),
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.sehun,
    type: 'ESTIMATE_CONFIRMED',
    content: notificationMessage.estimateConfirmed('김민재', 'mover'),
    targetPath: ESTIMATE.sehunMinjae,
    isRead: true,
    createdAt: days(-8),
  },
  {
    userId: MOVER.minjae,
    type: 'ESTIMATE_CONFIRMED',
    content: notificationMessage.estimateConfirmed('오세훈', 'customer'),
    targetPath: ESTIMATE.sehunMinjae,
    isRead: false,
    createdAt: days(-8),
  },
  {
    userId: CUSTOMER.sehun,
    type: 'MOVE_DAY',
    content: notificationMessage.moveDay(
      '내일',
      notificationMessage.toMoveDayPlace(
        '경기도 성남시 분당구 판교역로 235 102동 1503호'
      ),
      notificationMessage.toMoveDayPlace(
        '경기도 수원시 영통구 광교중앙로 145 305동 802호'
      )
    ),
    targetPath: ESTIMATE.sehunMinjae,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: MOVER.haneul,
    type: 'NEW_REQUEST',
    content: notificationMessage.newRequest('배진우', 'SMALL_MOVE'),
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.jinwoo,
    type: 'NEW_ESTIMATE',
    content: notificationMessage.newEstimate('정하늘', 'SMALL_MOVE'),
    targetPath: ESTIMATE.jinwooHaneul,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: CUSTOMER.nayoung,
    type: 'MOVE_DAY',
    content: notificationMessage.moveDay(
      '오늘',
      notificationMessage.toMoveDayPlace(
        '인천광역시 남동구 예술로 149 201동 1102호'
      ),
      notificationMessage.toMoveDayPlace('인천광역시 중구 영종대로 106 508호')
    ),
    targetPath: ESTIMATE.nayoungHaneul,
    isRead: true,
    createdAt: days(-20),
  },
] as const;

/**
 * 알림 목록(GET /notifications) 페이지네이션 확인용 — 기본 size가 10이라
 * 시연용 일반회원 앞으로 12건을 더 만듭니다. 4-3의 확정 견적을 targetPath로 걸어
 * 알림을 눌렀을 때 실제로 존재하는 견적으로 이동합니다.
 */
const paginationNotifications = reviewPaginationRequests
  .slice(0, 12)
  .map((request, index) => ({
    userId: DEMO.customer,
    type: 'NEW_ESTIMATE' as NotificationType,
    content: notificationMessage.newEstimate(
      demoMover.name,
      request.serviceType
    ),
    targetPath: request.estimates[0].id,
    // 3건 중 1건만 읽음 — 안 읽은 알림 뱃지 개수도 같이 확인됩니다.
    isRead: index % 3 === 0,
    createdAt: days(-10 - index),
  }));

/** 시연용 두 계정이 로그인 직후 바로 보게 되는 안 읽은 알림 */
const demoNotifications = [
  {
    userId: DEMO.customer,
    type: 'NEW_ESTIMATE' as NotificationType,
    content: notificationMessage.newEstimate('김민재', 'SMALL_MOVE'),
    targetPath: DEMO.proposedEstimate1,
    isRead: false,
    createdAt: days(-1),
  },
  {
    userId: DEMO.customer,
    type: 'ESTIMATE_CONFIRMED' as NotificationType,
    content: notificationMessage.estimateConfirmed(demoMover.name, 'mover'),
    targetPath: reviewPaginationRequests[0].estimates[0].id,
    isRead: false,
    createdAt: days(-3),
  },
  {
    userId: DEMO.customer,
    type: 'ESTIMATE_CONFIRMED' as NotificationType,
    content: notificationMessage.estimateConfirmed(demoMover.name, 'mover'),
    targetPath: reviewPaginationRequests[2].estimates[0].id,
    isRead: true,
    createdAt: days(-40),
  },
  {
    userId: DEMO.mover,
    type: 'NEW_REQUEST' as NotificationType,
    content: notificationMessage.newRequest(demoCustomer.name, 'SMALL_MOVE'),
    targetPath: DEMO.designatedEstimate,
    isRead: false,
    createdAt: days(-2),
  },
  {
    userId: DEMO.mover,
    type: 'ESTIMATE_CONFIRMED' as NotificationType,
    content: notificationMessage.estimateConfirmed('임하늘', 'customer'),
    targetPath: seqId(DEMO_ESTIMATE_ID_PREFIX, 23),
    isRead: false,
    createdAt: days(-3),
  },
  {
    userId: DEMO.mover,
    type: 'ESTIMATE_CONFIRMED' as NotificationType,
    content: notificationMessage.estimateConfirmed(
      demoCustomer.name,
      'customer'
    ),
    targetPath: reviewPaginationRequests[0].estimates[0].id,
    isRead: true,
    createdAt: days(-200),
  },
  {
    userId: DEMO.mover,
    type: 'MOVE_DAY' as NotificationType,
    content: notificationMessage.moveDay(
      '내일',
      notificationMessage.toMoveDayPlace(
        '인천광역시 연수구 컨벤시아대로 165 7층'
      ),
      notificationMessage.toMoveDayPlace('인천광역시 서구 청라커낼로 250 4층')
    ),
    targetPath: seqId(DEMO_ESTIMATE_ID_PREFIX, 23),
    isRead: false,
    createdAt: days(0),
  },
];

/** 지정 견적 요청마다 기사님 NEW_REQUEST — 알림 목록이 한 페이지(10건)를 넘기게 합니다. */
const demoMoverRequestNotifications = demoDesignatedFixtures.map(
  (fixture, index) => ({
    userId: DEMO.mover,
    type: 'NEW_REQUEST' as NotificationType,
    content: notificationMessage.newRequest(fixture.name, fixture.serviceType),
    targetPath: fixture.estimateId,
    isRead: index % 4 === 0,
    createdAt: fixture.createdAt,
  })
);

const allNotifications = [
  ...notifications,
  ...paginationNotifications,
  ...demoNotifications,
  ...demoMoverRequestNotifications,
];

async function seedNotifications() {
  await prisma.notification.createMany({ data: allNotifications });
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

async function main() {
  // bcrypt 해시는 비용이 큰 연산이라 한 번만 계산합니다.
  seedPasswordHash = await hashPassword(SEED_PASSWORD);

  console.log('기존 데이터 삭제 중...');
  await clear();

  console.log('기사님 계정 생성 중...');
  await seedMovers();

  console.log('일반 유저 계정 생성 중...');
  await seedCustomers();

  console.log('견적 요청 / 견적 생성 중...');
  await seedEstimateRequests();

  console.log('받은 요청 목록용 데이터 생성 중...');
  await seedReceivedFixtures();

  console.log('시연 기사님 반려 요청 생성 중...');
  await seedDemoRejectedFixtures();

  console.log('시연 기사님 보낸 견적(이사 전) 생성 중...');
  await seedDemoSentEstimates();

  console.log('리뷰 생성 중...');
  await seedReviews();

  console.log('찜 생성 중...');
  await seedLikes();

  console.log('알림 생성 중...');
  await seedNotifications();

  const estimateCount = allEstimateRequests.reduce(
    (sum, request) => sum + request.estimates.length,
    0
  );

  const designatedCount = allReceivedFixtures.filter(
    (fixture) => fixture.designatedTo
  ).length;

  console.log(
    [
      '시드 완료',
      `- 기사님 ${allMovers.length}명 / 일반 유저 ${allCustomers.length + allReceivedFixtures.length + demoRejectedFixtures.length + demoSentFixtures.length}명`,
      `- 견적 요청 ${allEstimateRequests.length + allReceivedFixtures.length + demoRejectedFixtures.length + demoSentFixtures.length}건 / 견적 ${estimateCount + designatedCount + demoRejectedFixtures.length + demoSentFixtures.length + 1}건`,
      `- 받은 요청 목록용 PENDING ${allReceivedFixtures.length}건 (지정 ${designatedCount}건)`,
      `- 시연 기사님 지정 견적 ${demoDesignatedFixtures.length + 1}건 / 반려 요청 ${demoRejectedFixtures.length}건 / 보낸 견적(이사 전) ${demoSentFixtures.length}건`,
      `- 리뷰 ${allReviews.length}건 / 찜 ${allLikes.length}건 / 알림 ${allNotifications.length}건`,
      `- 로컬 계정 공통 비밀번호: ${SEED_PASSWORD}`,
      '',
      '[발표 시연용 계정]',
      `- 일반회원  ${demoCustomer.email} / ${SEED_PASSWORD}  (${demoCustomer.name})`,
      `- 기사회원  ${demoMover.email} / ${SEED_PASSWORD}  (${demoMover.name} · ${demoMover.nickname})`,
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
