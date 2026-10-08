import { NextFunction, Request, Response } from 'express';
import { isRedisReady, redis } from '../lib/redis';

/*=================================================
GET 응답 캐시 미들웨어
=================================================*/
/*
@ 가이드
- 키는 cache:{경로+정렬된 쿼리}. 예) cache:/mover?region=SEOUL&size=10
- 200 응답만 저장한다. 에러 응답(errorHandler)은 저장하지 않는다
- Redis 가 없거나 끊겨 있으면 캐시를 건너뛰고 그대로 next() 한다
@ 주의사항
- authenticate 를 쓰는 라우트에는 붙이지 않는다.
  키에 사용자 정보가 없어서 다른 사람의 응답이 그대로 나간다
*/
const toCacheKey = (originalUrl: string) => {
  const url = new URL(originalUrl, 'http://localhost');
  url.searchParams.sort();
  return `cache:${url.pathname}${url.search}`;
};

export const cacheResponse =
  (ttlSeconds: number) =>
  async (req: Request, res: Response, next: NextFunction) => {
    // 아래 res.json 클로저 안에서도 null 이 아님을 유지하려고 지역 변수로 받는다
    const client = redis;
    if (!client || !isRedisReady()) return next();

    const key = toCacheKey(req.originalUrl);
    const cached = await client.get(key).catch(() => null);
    if (cached !== null) {
      res.json(JSON.parse(cached));
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        client
          .set(key, JSON.stringify(body), 'EX', ttlSeconds)
          .catch((error: unknown) => console.error('[redis] set 실패', error));
      }
      return originalJson(body);
    };
    next();
  };
