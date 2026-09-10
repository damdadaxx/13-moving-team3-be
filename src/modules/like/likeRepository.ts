import { Prisma } from '../../generated/prisma/client';
import { EstimateStatus } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { buildCursorArgs } from '../../utils/cursorPagination';
import { GetLikeMoverListData } from './likeTypes';

const likeRepository = {
  //찜을 누른 기사님 목록
  getLikeMoverList: async ({ userId, cursor, size }: GetLikeMoverListData) => {
    const [likeMoversList, totalCount] = await Promise.all([
      prisma.like.findMany({
        where: {
          customerId: userId,
        },
        include: { mover: { include: { serviceTypes: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorArgs(cursor, size),
      }),
      prisma.like.count({
        where: {
          customerId: userId,
        },
      }),
    ]);
    return { likeMoversList, totalCount };
  },
  getRatingInfo: async (moverIds: string[]) => {
    const ratingInfo = await prisma.review.groupBy({
      by: ['moverId'],
      where: { moverId: { in: moverIds } },
      _count: { rating: true },
      _avg: { rating: true },
    });
    return ratingInfo;
  },
  //기사님 확정견적 개수 가져오기
  getAcceptedEstimateCountList: async (moverIds: string[]) => {
    const acceptedEstimateCount = await prisma.estimate.groupBy({
      by: ['moverId'],
      where: { moverId: { in: moverIds }, status: EstimateStatus.ACCEPTED },
      _count: { id: true },
    });
    return acceptedEstimateCount;
  },
  //찜했는지 확인하는 함수.
  findLike: async (where: Prisma.LikeWhereUniqueInput) => {
    const likeInfo = await prisma.like.findUnique({
      where,
    });
    return likeInfo;
  },
  findLikeList: async (moverIds: string[], userId: string) => {
    const likeInfoList = await prisma.like.findMany({
      where: { moverId: { in: moverIds }, customerId: userId },
    });
    return likeInfoList;
  },
  //해당 기사의 찜 개수
  getLikeCount: async (moverId: string) => {
    const likeCount = await prisma.like.count({
      where: {
        moverId,
      },
    });
    return likeCount;
  },
  //각 기사님의 찜의 개수.
  getLikeCountList: async (moverIds: string[]) => {
    const likeCountList = await prisma.like.groupBy({
      by: ['moverId'],
      where: { moverId: { in: moverIds } },
      _count: { id: true },
    });
    return likeCountList;
  },
  createLike: async (moverId: string, userId: string) => {
    const like = await prisma.like.create({
      data: {
        moverId,
        customerId: userId,
      },
    });
    return like;
  },
  bulkDeleteLike: async (moverIds: string[]) => {
    const deletedLikeList = await prisma.like.deleteMany({
      where: { moverId: { in: moverIds } },
    });
    return deletedLikeList;
  },
  deleteLike: async (where: Prisma.LikeWhereUniqueInput) => {
    const like = await prisma.like.delete({
      where,
    });
    return like;
  },
};

export default likeRepository;
