export interface GetMyReviewsRequest {
  page: number;
  pageSize: number;
  hasReview?: boolean;
}
export type GetMyReviewsData = GetMyReviewsRequest & { userId: string };

export interface GetMoverReviewsRequest {
  page: number;
  pageSize: number;
}
export type GetMoverReviewsData = GetMoverReviewsRequest & { moverId: string };

export interface CreateReviewRequest {
  userId: string;
  estimateId: string;
  content: string;
  rating: number;
}
export type CreateReviewData = CreateReviewRequest & { moverId: string };
