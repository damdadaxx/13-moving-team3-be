import type { Request, Response } from 'express';
import type { AugmentedRequest } from 'express-rate-limit';
import { RedisOrMemoryStore } from '../lib/rateLimitStore';
import { createRateLimit, ipKey } from '../modules/auth/authRateLimit';

/*=================================================
AI 기능 요청 제한 (Gemini 비용·무료 한도 보호)
=================================================*/
/*
@ 가이드
- 유저 단위로 센다 (authenticate 뒤에 둔다). 하루 한도 하나만 건다
  - 한국시간 자정에 초기화. 실패한 요청(Gemini 오류 등)은 차감하지 않는다
  - 분 단위 연타 제한은 두지 않는다 (하루 5회라 연타해도 최대 5번)
- 하루 한도의 남은 횟수는 응답 바디의 usage 로 내려준다.
  FE 프록시가 RateLimit 헤더를 전달하지 않기 때문이다
@ 주의사항
- usage 에는 limit · remaining · resetAt 만 담는다. req[...] 의 RateLimitInfo 에는 저장소 키(userId 포함)도
  들어 있으니 그대로 펼치지 않는다 (toAiUsage)
- 한도를 바꾸면 Gemini 프로젝트 한도(AI Studio > Rate limits) 안인지 같이 확인한다
*/

export type AiFeature = 'moverSearch' | 'reviewDraft';

interface AiLimitConfig {
  dailyLimit: number;
}

export const AI_LIMITS: Record<AiFeature, AiLimitConfig> = {
  moverSearch: { dailyLimit: 5 },
  reviewDraft: { dailyLimit: 5 },
};

export interface AiUsage {
  limit: number;
  remaining: number;
  resetAt: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 한국시간 기준 날짜 (예: 2026-10-21). 하루 한도 키에 붙여서 자정이 지나면 새 키가 되게 한다
export const getKstDate = (now = Date.now()) =>
  new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);

// 다음 한국시간 자정 (UTC Date)
export const getNextKstMidnight = (now = Date.now()) => {
  const kst = new Date(now + KST_OFFSET_MS);
  kst.setUTCHours(24, 0, 0, 0);
  return new Date(kst.getTime() - KST_OFFSET_MS);
};

const getUserKey = (req: Request) => req.auth?.sub ?? `ip:${ipKey(req)}`;

const getDailyKey = (userKey: string) => `${userKey}:${getKstDate()}`;

const dailyPropertyName = (feature: AiFeature) => `aiDaily_${feature}`;

export const toAiUsage = (feature: AiFeature, hits: number): AiUsage => {
  const limit = AI_LIMITS[feature].dailyLimit;
  return {
    limit,
    remaining: Math.max(limit - hits, 0),
    resetAt: getNextKstMidnight().toISOString(),
  };
};

const createAiRateLimit = (feature: AiFeature) => {
  const { dailyLimit } = AI_LIMITS[feature];

  const daily = createRateLimit(
    DAY_MS,
    dailyLimit,
    (req) => getDailyKey(getUserKey(req)),
    (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'DAILY_LIMIT_EXCEEDED',
          message: `오늘 사용할 수 있는 횟수(${dailyLimit}회)를 모두 사용했어요. 매일 자정에 초기화돼요.`,
        },
      });
    },
    {
      store: new RedisOrMemoryStore(`ai:${feature}:daily:`),
      passOnStoreError: true,
      skipFailedRequests: true,
      requestPropertyName: dailyPropertyName(feature),
    }
  );

  return { middleware: daily, daily };
};

const limiters: Record<AiFeature, ReturnType<typeof createAiRateLimit>> = {
  moverSearch: createAiRateLimit('moverSearch'),
  reviewDraft: createAiRateLimit('reviewDraft'),
};

export const moverAiSearchRateLimit = limiters.moverSearch.middleware;
export const reviewDraftRateLimit = limiters.reviewDraft.middleware;

/*
@ getAiUsageFromRequest
- 하루 한도 리미터를 통과한 요청에서 "이번 요청까지 포함한" 남은 횟수를 꺼낸다
- 성공 응답 바디에 usage 로 붙인다
*/
export const getAiUsageFromRequest = (
  req: Request,
  feature: AiFeature
): AiUsage => {
  const info = (req as AugmentedRequest)[dailyPropertyName(feature)];
  return toAiUsage(feature, info?.used ?? 0);
};

/*
@ getAiUsage
- GET /ai/usage 용. 차감하지 않고 조회만 한다
*/
export const getAiUsage = async (
  userId: string
): Promise<Record<AiFeature, AiUsage>> => {
  const dailyKey = getDailyKey(userId);
  const [moverSearch, reviewDraft] = await Promise.all(
    (['moverSearch', 'reviewDraft'] as const).map(async (feature) => {
      const info = await limiters[feature].daily.getKey(dailyKey);
      return toAiUsage(feature, info?.totalHits ?? 0);
    })
  );
  return { moverSearch, reviewDraft };
};
