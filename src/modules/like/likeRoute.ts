import express from 'express';
import likeController from './likeController';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import {
  bulkDeleteLikeSchema,
  getLikeMoverListSchema,
  likeMoverIdSchema,
} from './likeSchema';

const likeRouter = express.Router();

//기사님을 찜한 목록페이지
likeRouter.get(
  '/me',
  authenticate,
  validate(getLikeMoverListSchema, 'query'),
  likeController.getLikeMoverList
);
//기사님의 찜 개수 보기. (비 로그인)
likeRouter.get(
  '/:moverId',
  validate(likeMoverIdSchema, 'params'),
  likeController.getLikeMoverCount
);
//기사님의 찜 개수 및 찜했는지 확인. (로그인)
likeRouter.get(
  '/me/:moverId',
  authenticate,
  validate(likeMoverIdSchema, 'params'),
  likeController.getLikeMoverInfo
);
//기사님을 찜하기
likeRouter.post(
  '/',
  authenticate,
  validate(likeMoverIdSchema),
  likeController.createLike
);
//여러개의 기사님을 찜 취소하기
likeRouter.post(
  '/bulk-delete',
  authenticate,
  validate(bulkDeleteLikeSchema),
  likeController.bulkDeleteLike
);
//기사님을 찜 취소하기
likeRouter.delete(
  '/:moverId',
  authenticate,
  validate(likeMoverIdSchema, 'params'),
  likeController.deleteLike
);

export default likeRouter;
