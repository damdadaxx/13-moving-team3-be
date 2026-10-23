import type { NextFunction, Request, Response } from 'express';
import { getAiUsage } from '../../middlewares/aiRateLimit';
import { UnauthorizedError } from '../../utils/error';

const aiController = {
  /*
  @ getUsage

  - 오늘 남은 AI 사용 횟수(기사님 AI 검색 · 리뷰 초안)를 반환합니다.
  - 조회만 하고 횟수를 차감하지 않습니다.
  - 각 항목은 limit · remaining · resetAt(다음 한국시간 자정)만 담습니다.
  */
  getUsage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        throw new UnauthorizedError();
      }

      const usage = await getAiUsage(userId);
      return res.status(200).json({ success: true, data: usage });
    } catch (error: unknown) {
      return next(error);
    }
  },
};

export default aiController;
