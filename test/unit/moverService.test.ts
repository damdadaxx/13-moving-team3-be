import { Role } from '../../src/generated/prisma/client';
import moverService from '../../src/modules/mover/moverService';
import moverRepository from '../../src/modules/mover/moverRepository';
import { ConflictError, ForbiddenError } from '../../src/utils/error';

jest.mock('../../src/modules/mover/moverRepository');
jest.mock('../../src/modules/mover/moverImage');
jest.mock('../../src/lib/redis');

const findByUserId = jest.mocked(moverRepository.findByUserId);
const create = jest.mocked(moverRepository.create);

const INPUT = {
  nickname: '새기사',
  careerMonths: 12,
  shortIntro: '정직하게 견적 드립니다',
  description: '포장부터 정리까지 책임지고 이사해 드립니다.',
  serviceTypes: ['SMALL_MOVE' as const],
  serviceRegions: ['SEOUL' as const],
};
type CreateParams = Parameters<typeof moverService.createProfile>[0];

describe('moverService.createProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('기사님이 아니면 403 이고 DB 를 조회하지 않는다', async () => {
    await expect(
      moverService.createProfile({
        userId: 'customer-1',
        role: Role.CUSTOMER,
        input: INPUT,
      } as CreateParams)
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  test('이미 프로필이 있으면 409', async () => {
    findByUserId.mockResolvedValue({ userId: 'mover-1' } as Awaited<
      ReturnType<typeof moverRepository.findByUserId>
    >);

    await expect(
      moverService.createProfile({
        userId: 'mover-1',
        role: Role.MOVER,
        input: INPUT,
      } as CreateParams)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(create).not.toHaveBeenCalled();
  });
});
