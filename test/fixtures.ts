import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/utils/hash';
import type {
  Prisma,
  Region,
  ServiceType,
} from '../src/generated/prisma/client';

/*=================================================
통합 테스트 픽스처
=================================================*/
/*
@ 가이드
- 테스트에 필요한 사용자·프로필·견적 요청을 DB 에 바로 만든다. (API 로 만드는 과정 자체는 각 도메인 테스트가 검증한다)
- loginAs 는 로그인 쿠키가 담긴 supertest agent 를 돌려준다.
@ 주의사항
- 모든 계정의 비밀번호는 PASSWORD. bcrypt 해시는 한 번만 계산해 재사용한다 (테스트 속도)
*/
export const PASSWORD = 'test1234!';

const DAY = 24 * 60 * 60 * 1000;
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

let sequence = 0;
const nextEmail = (prefix: string) => `${prefix}${++sequence}@test.kr`;

let passwordHash: Promise<string> | undefined;
const getPasswordHash = () => (passwordHash ??= hashPassword(PASSWORD));

type CustomerOptions = {
  name?: string;
  region?: Region;
  withProfile?: boolean;
};

export const createCustomer = async ({
  name = '테스트고객',
  region = 'SEOUL',
  withProfile = true,
}: CustomerOptions = {}) =>
  prisma.user.create({
    data: {
      name,
      email: nextEmail('customer'),
      password: await getPasswordHash(),
      role: 'CUSTOMER',
      ...(withProfile && {
        customerProfile: {
          create: {
            region,
            serviceTypes: { create: [{ serviceType: 'HOME_MOVE' }] },
          },
        },
      }),
    },
  });

type MoverOptions = {
  name?: string;
  nickname?: string;
  regions?: Region[];
  serviceTypes?: ServiceType[];
  withProfile?: boolean;
};

export const createMover = async ({
  name = '테스트기사',
  nickname = '테스트이사',
  regions = ['SEOUL'],
  serviceTypes = ['SMALL_MOVE', 'HOME_MOVE'],
  withProfile = true,
}: MoverOptions = {}) =>
  prisma.user.create({
    data: {
      name,
      email: nextEmail('mover'),
      password: await getPasswordHash(),
      role: 'MOVER',
      ...(withProfile && {
        moverProfile: {
          create: {
            nickname,
            careerMonths: 24,
            shortIntro: '친절하고 꼼꼼하게 옮겨 드립니다',
            description: '십 년 경력으로 파손 없이 안전하게 이사해 드립니다.',
            serviceTypes: {
              create: serviceTypes.map((serviceType) => ({ serviceType })),
            },
            serviceRegions: {
              create: regions.map((region) => ({ region })),
            },
          },
        },
      }),
    },
  });

export const createEstimateRequest = (
  customerId: string,
  overrides: Partial<Prisma.EstimateRequestUncheckedCreateInput> = {}
) =>
  prisma.estimateRequest.create({
    data: {
      customerId,
      serviceType: 'HOME_MOVE',
      moveDate: daysFromNow(7),
      departureZipCode: '04524',
      departureAddress: '서울특별시 중구 세종대로 110',
      arrivalZipCode: '06035',
      arrivalAddress: '서울특별시 강남구 가로수길 5',
      ...overrides,
    },
  });

export const loginAs = async (user: { email: string; role: string }) => {
  const agent = request.agent(app);
  await agent
    .post('/auth/login')
    .send({ email: user.email, password: PASSWORD, role: user.role })
    .expect(200);
  return agent;
};
