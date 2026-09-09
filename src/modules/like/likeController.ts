import { Request, Response } from 'express';
import likeService from './likeService';
import { UnauthorizedError } from '../../utils/error';
import {
  BulkDeleteLikeInput,
  DeleteLikeInput,
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

    const { nextCursorId, limit } = req.validatedData as GetLikeMoverListInput;

    const { result, nextId, likeMoverTotal } =
      await likeService.getLikeMoverList({ userId, role, nextCursorId, limit });
    return res.status(200).json({
      success: true,
      data: { result, nextId, likeMoverTotal },
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
    const { likeIds } = req.validatedData as BulkDeleteLikeInput;
    const data = await likeService.bulkDeleteLike({ likeIds, userId, role });
    return res.status(200).json({ success: true, data });
  },
  deleteLike: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError('로그인이 필요합니다.');
    }
    const userId: string = req.auth.sub as string;
    const role: string = req.auth.role as string;
    const { likeId } = req.validatedData as DeleteLikeInput;
    const data = await likeService.deleteLike({ likeId, userId, role });
    return res.status(200).json({ success: true, data });
  },
};

export default likeController;
