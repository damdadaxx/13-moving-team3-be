import { z } from 'zod';
import {
  bulkDeleteLikeSchema,
  deleteLikeSchema,
  getLikeMoverListSchema,
  likeMoverIdSchema,
} from './likeSchema';

export interface AuthenticatedInput {
  userId: string;
  role?: string;
}

export type LikeMoverIdInput = z.infer<typeof likeMoverIdSchema>;
export type GetLikeMoverListInput = z.infer<typeof getLikeMoverListSchema>;
export type DeleteLikeInput = z.infer<typeof deleteLikeSchema>;
export type BulkDeleteLikeInput = z.infer<typeof bulkDeleteLikeSchema>;

export type GetLikeMoverListData = AuthenticatedInput & GetLikeMoverListInput;
