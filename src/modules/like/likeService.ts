import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { paginateByCursor } from '../../utils/cursorPagination';
import { BadRequestError, ForbiddenError } from '../../utils/error';
import likeRepository from './likeRepository';
import {
  AuthenticatedInput,
  BulkDeleteLikeInput,
  GetLikeMoverListData,
  LikeMoverIdInput,
} from './likeTypes';

const likeService = {
  getLikeMoverList: async ({
    userId,
    role,
    cursor,
    size,
  }: GetLikeMoverListData) => {
    if (role !== Role.CUSTOMER) {
      //기사 페이지에서 찜한 기사목록을 보여주지는 않는것 같아서 고객만 볼 수 있게 처리.
      throw new ForbiddenError('고객만 찜 목록을 볼 수 있습니다.');
    }

    const { likeMoversList, totalCount } =
      await likeRepository.getLikeMoverList({ userId, cursor, size });
    const { items, nextCursor } = paginateByCursor(likeMoversList, size);

    const moverIds = items ? items.map((data) => data.moverId) : [];
    //찜한 기사가 없다면 빈 배열로 반환.
    if (moverIds.length === 0) {
      return { list: [], nextCursor: null, totalCount: 0 };
    }

    const [ratingInfo, acceptedEstimateCountList, likeCountList] =
      await Promise.all([
        likeRepository.getRatingInfo(moverIds),
        likeRepository.getAcceptedEstimateCountList(moverIds),
        likeRepository.getLikeCountList(moverIds),
      ]);

    const result = items.map((data) => {
      const findRatingInfo = ratingInfo.find(
        (info) => info.moverId === data.moverId
      );

      return {
        ...data,
        mover: {
          ...data.mover,
          serviceTypes: data.mover.serviceTypes.map(
            (service) => service.serviceType
          ),
        },
        ratingCount: findRatingInfo?._count.rating ?? 0,
        ratingAvg: findRatingInfo?._avg.rating?.toFixed(1) ?? 0,
        acceptedEstimateCount:
          acceptedEstimateCountList.find(
            (info) => info.moverId === data.moverId
          )?._count.id ?? 0,
        likeCount:
          likeCountList.find((info) => info.moverId === data.moverId)?._count
            .id ?? 0,
      };
    });

    return { list: result, nextCursor, totalCount };
  },
  getLikeMoverCount: async ({ moverId }: LikeMoverIdInput) => {
    const likeCount = await likeRepository.getLikeCount(moverId);
    return likeCount;
  },
  getLikeMoverInfo: async ({
    moverId,
    userId,
  }: LikeMoverIdInput & AuthenticatedInput) => {
    const where: Prisma.LikeWhereUniqueInput = {
      customerId_moverId: {
        customerId: userId,
        moverId,
      },
    };

    const [likeInfo, likeCount] = await Promise.all([
      likeRepository.findLike(where),
      likeRepository.getLikeCount(moverId),
    ]);

    const isLiked = likeInfo ? true : false;
    const likeId = likeInfo?.id;

    return { isLiked, likeCount, likeId };
  },
  createLike: async ({
    moverId,
    userId,
    role,
  }: LikeMoverIdInput & AuthenticatedInput) => {
    if (role !== Role.CUSTOMER) {
      //기사 페이지에서 찜한 기사목록을 보여주지는 않는것 같아서 고객만 누를 수 있게 처리.
      throw new ForbiddenError('고객만 기사님을 찜할 수 있습니다.');
    }

    const where: Prisma.LikeWhereUniqueInput = {
      customerId_moverId: {
        customerId: userId,
        moverId,
      },
    };
    const likeInfo = await likeRepository.findLike(where);
    if (likeInfo) {
      throw new BadRequestError('이미 찜한 기사님 입니다.');
    }
    const like = await likeRepository.createLike(moverId, userId);
    const likeCount = await likeRepository.getLikeCount(moverId);

    return { like, likeCount };
  },
  bulkDeleteLike: async ({
    moverIds,
    userId,
    role,
  }: BulkDeleteLikeInput & AuthenticatedInput) => {
    if (role !== Role.CUSTOMER) {
      throw new ForbiddenError('고객만 찜을 여러개 취소할 수 있습니다.');
    }

    const likeInfoList = await likeRepository.findLikeList(moverIds, userId);
    if (likeInfoList.length !== moverIds.length) {
      throw new BadRequestError('찜을 먼저 해야 취소할 수 있습니다.');
    }

    await likeRepository.bulkDeleteLike(moverIds);
    const likeCountList = await likeRepository.getLikeCountList(moverIds);

    const result = likeInfoList.map((info) => {
      const findLikeCount = likeCountList.find(
        (count) => count.moverId === info.moverId
      );
      return {
        moverId: info.moverId,
        likeCount: findLikeCount?._count.id ?? 0,
      };
    });

    //삭제하고 삭제한 후의 각 기사님의 찜개수만 보낸다.
    return { result };
  },
  deleteLike: async ({
    moverId,
    userId,
    role,
  }: LikeMoverIdInput & AuthenticatedInput) => {
    if (role !== Role.CUSTOMER) {
      throw new ForbiddenError('고객만 찜을 취소할 수 있습니다.');
    }
    const where: Prisma.LikeWhereUniqueInput = {
      customerId_moverId: {
        customerId: userId,
        moverId,
      },
    };
    const likeInfo = await likeRepository.findLike(where);
    if (!likeInfo) {
      throw new BadRequestError('찜을 먼저 해야 취소할 수 있습니다.');
    }
    await likeRepository.deleteLike(where);
    const likeCount = await likeRepository.getLikeCount(likeInfo.moverId);
    return { likeCount };
  },
};

export default likeService;
