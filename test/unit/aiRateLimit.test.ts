import express, { type Request, type Response } from 'express';
import request from 'supertest';
import {
  getAiUsage,
  getAiUsageFromRequest,
  getKstDate,
  getNextKstMidnight,
  moverAiSearchRateLimit,
  toAiUsage,
} from '../../src/middlewares/aiRateLimit';

// Redis 없이 메모리 저장소로 센다
jest.mock('../../src/lib/redis');

describe('KST 날짜 계산', () => {
  test('UTC 15:00 이후는 한국 날짜로 다음 날이다', () => {
    expect(getKstDate(Date.parse('2026-10-21T14:59:59Z'))).toBe('2026-10-21');
    expect(getKstDate(Date.parse('2026-10-21T15:00:00Z'))).toBe('2026-10-22');
  });

  test('다음 초기화 시각은 다음 한국시간 자정이다', () => {
    expect(
      getNextKstMidnight(Date.parse('2026-10-21T03:00:00Z')).toISOString()
    ).toBe('2026-10-21T15:00:00.000Z');
  });
});

describe('toAiUsage', () => {
  // 응답 바디에 저장소 키(userId 포함) 같은 내부 값이 섞이지 않게 한다
  test('limit · remaining · resetAt 세 값만 담는다', () => {
    const usage = toAiUsage('moverSearch', 2);
    expect(Object.keys(usage).sort()).toEqual([
      'limit',
      'remaining',
      'resetAt',
    ]);
    expect(usage).toMatchObject({ limit: 5, remaining: 3 });
  });

  test('한도를 넘겨도 remaining 은 0 아래로 내려가지 않는다', () => {
    expect(toAiUsage('reviewDraft', 9).remaining).toBe(0);
  });
});

describe('moverAiSearchRateLimit', () => {
  const buildApp = (userId: string) => {
    const app = express();
    app.use((req: Request, _res: Response, next) => {
      req.auth = { sub: userId, role: 'CUSTOMER' };
      next();
    });
    app.get('/ok', moverAiSearchRateLimit, (req: Request, res: Response) => {
      res.json({ usage: getAiUsageFromRequest(req, 'moverSearch') });
    });
    app.get('/fail', moverAiSearchRateLimit, (_req: Request, res: Response) => {
      res.status(503).json({});
    });
    return app;
  };

  // 분 단위 제한은 없다 — 연달아 5번까지 성공하고 6번째에서 하루 한도로 막힌다
  test('성공하면 하루 남은 횟수가 1씩 줄고, 6번째 요청은 하루 한도 429', async () => {
    const app = buildApp('user-daily');

    for (let expected = 4; expected >= 0; expected -= 1) {
      const res = await request(app).get('/ok');
      expect(res.status).toBe(200);
      expect(res.body.usage.remaining).toBe(expected);
    }

    const blocked = await request(app).get('/ok');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('DAILY_LIMIT_EXCEEDED');
  });

  test('실패한 요청은 하루 횟수에서 차감하지 않는다', async () => {
    const app = buildApp('user-fail');

    await request(app).get('/fail');
    await request(app).get('/fail');

    const usage = await getAiUsage('user-fail');
    expect(usage.moverSearch.remaining).toBe(5);
    // 다른 기능의 횟수와 섞이지 않는다
    expect(usage.reviewDraft.remaining).toBe(5);
  });
});
