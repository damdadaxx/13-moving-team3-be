import { Role } from '../../src/generated/prisma/enums';
import likeService from '../../src/modules/like/likeService';
import likeRepository from '../../src/modules/like/likeRepository';
import { BadRequestError, ForbiddenError } from '../../src/utils/error';

jest.mock('../../src/modules/like/likeRepository');
jest.mock('../../src/lib/redis');

const findLike = jest.mocked(likeRepository.findLike);
const createLike = jest.mocked(likeRepository.createLike);
const deleteLike = jest.mocked(likeRepository.deleteLike);
const getLikeCount = jest.mocked(likeRepository.getLikeCount);

const customer = { userId: 'customer-1', role: Role.CUSTOMER };
const MOVER_ID = 'mover-1';
type FoundLike = Awaited<ReturnType<typeof likeRepository.findLike>>;

describe('likeService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createLike', () => {
    test('고객이 아니면 403', async () => {
      await expect(
        likeService.createLike({
          moverId: MOVER_ID,
          userId: 'mover-2',
          role: Role.MOVER,
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(findLike).not.toHaveBeenCalled();
    });

    test('이미 찜했으면 400', async () => {
      findLike.mockResolvedValue({ id: 'like-1' } as FoundLike);

      await expect(
        likeService.createLike({ moverId: MOVER_ID, ...customer })
      ).rejects.toBeInstanceOf(BadRequestError);
      expect(createLike).not.toHaveBeenCalled();
    });

    test('찜을 만들고 최신 찜 수를 돌려준다', async () => {
      findLike.mockResolvedValue(null);
      createLike.mockResolvedValue({ id: 'like-1' } as Awaited<
        ReturnType<typeof likeRepository.createLike>
      >);
      getLikeCount.mockResolvedValue(3);

      const result = await likeService.createLike({
        moverId: MOVER_ID,
        ...customer,
      });

      expect(createLike).toHaveBeenCalledWith(MOVER_ID, 'customer-1');
      expect(result.likeCount).toBe(3);
    });
  });

  describe('deleteLike', () => {
    test('찜하지 않은 기사님이면 400', async () => {
      findLike.mockResolvedValue(null);

      await expect(
        likeService.deleteLike({ moverId: MOVER_ID, ...customer })
      ).rejects.toBeInstanceOf(BadRequestError);
      expect(deleteLike).not.toHaveBeenCalled();
    });
  });
});
