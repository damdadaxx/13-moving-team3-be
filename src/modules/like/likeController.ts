import { Request, Response } from 'express';
import likeService from './likeService';
import { UnauthorizedError } from '../../utils/error';
import {
  BulkDeleteLikeInput,
  GetLikeMoverListInput,
  LikeMoverIdInput,
} from './likeTypes';

const likeController = {
  getLikeMoverList: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }
    const userId: string = req.auth.sub as string;
    const role: string = req.auth.role as string;

    const { cursor, size } = req.validatedData as GetLikeMoverListInput;

    const { list, nextCursor, totalCount } = await likeService.getLikeMoverList(
      { userId, role, cursor, size }
    );
    return res.status(200).json({
      success: true,
      data: { list, nextCursor, totalCount },
    });
  },
  getLikeMoverCount: async (req: Request, res: Response) => {
    const { moverId } = req.validatedData as LikeMoverIdInput;
    const count = await likeService.getLikeMoverCount({ moverId });
    return res.status(200).json({ success: true, data: { likeCount: count } });
  },
  getLikeMoverInfo: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }
    const userId: string = req.auth?.sub as string;
    const { moverId } = req.validatedData as LikeMoverIdInput;

    const { isLiked, likeCount, likeId } = await likeService.getLikeMoverInfo({
      moverId,
      userId,
    });
    return res
      .status(200)
      .json({ success: true, data: { isLiked, likeCount, likeId } });
  },
  createLike: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }

    const userId: string = req.auth.sub as string;
    const role: string = req.auth.role as string;
    const { moverId } = req.validatedData as LikeMoverIdInput;

    const { like, likeCount } = await likeService.createLike({
      moverId,
      userId,
      role,
    });
    return res.status(201).json({ success: true, data: { like, likeCount } });
  },
  bulkDeleteLike: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }
    const userId: string = req.auth.sub as string;
    const role: string = req.auth.role as string;
    const { moverIds } = req.validatedData as BulkDeleteLikeInput;
    const data = await likeService.bulkDeleteLike({ moverIds, userId, role });
    return res.status(200).json({ success: true, data });
  },
  deleteLike: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }
    const userId: string = req.auth.sub as string;
    const role: string = req.auth.role as string;
    const { moverId } = req.validatedData as LikeMoverIdInput;
    const data = await likeService.deleteLike({ moverId, userId, role });
    return res.status(200).json({ success: true, data });
  },
};

export default likeController;
