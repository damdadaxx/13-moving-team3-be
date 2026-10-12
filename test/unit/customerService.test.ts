import { Prisma } from '../../src/generated/prisma/client';
import { customerService } from '../../src/modules/customer/customerService';
import { customerRepository } from '../../src/modules/customer/customerRepository';
import { ConflictError, NotFoundError } from '../../src/utils/error';

jest.mock('../../src/modules/customer/customerRepository');

const findByUserId = jest.mocked(customerRepository.findByUserId);
const create = jest.mocked(customerRepository.create);

type ProfileRecord = Awaited<ReturnType<typeof customerRepository.create>>;
const profileRecord = {
  userId: 'customer-1',
  imgUrl: null,
  region: 'SEOUL',
  serviceTypes: [{ serviceType: 'HOME_MOVE' }],
  user: { name: '김고객', email: 'c@test.kr', phoneNumber: null },
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as ProfileRecord;

const INPUT = {
  region: 'SEOUL' as const,
  serviceTypes: ['HOME_MOVE' as const],
};

describe('customerService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('create: 이미 프로필이 있으면 409', async () => {
    findByUserId.mockResolvedValue(profileRecord);

    await expect(
      customerService.create('customer-1', INPUT)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  test('create: 동시 요청으로 DB 유니크 제약(P2002)에 걸려도 409 로 바꾼다', async () => {
    findByUserId.mockResolvedValue(null);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    await expect(
      customerService.create('customer-1', INPUT)
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test('create: 응답은 serviceTypes 를 문자열 배열로 펼친다', async () => {
    findByUserId.mockResolvedValue(null);
    create.mockResolvedValue(profileRecord);

    const result = await customerService.create('customer-1', INPUT);

    expect(result).toMatchObject({
      id: 'customer-1',
      name: '김고객',
      serviceTypes: ['HOME_MOVE'],
    });
  });

  test('get: 프로필이 없으면 404', async () => {
    findByUserId.mockResolvedValue(null);

    await expect(customerService.get('customer-1')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
