import {
  MemoryStore,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit';
import { isRedisReady, redis } from './redis';

/*=================================================
요청 제한 저장소 (Redis 우선, 없으면 메모리)
=================================================*/
/*
@ 가이드
- Redis 가 연결돼 있으면 Redis 에서 센다 → 서버가 여러 대여도 한도를 공유한다
- REDIS_URL 이 없거나(로컬) 연결이 끊겨 있으면 그 요청은 메모리에서 센다
- 키 하나는 숫자 하나 + TTL 이라 Redis 메모리를 거의 쓰지 않는다 (유저·리미터당 키 1개)
@ 주의사항
- rate-limit-redis 대신 직접 만든 이유: 그 패키지는 시작할 때 Lua 스크립트를 한 번 로드해 두는데,
  lib/redis.ts 가 enableOfflineQueue: false 라 연결 전에 로드가 실패하면 그 실패가 계속 남는다
- Redis ↔ 메모리를 오가는 동안에는 카운트가 이어지지 않는다 (장애 중에는 한도가 느슨해질 수 있다)
*/

// 첫 요청이면 TTL 과 함께 1로 만들고, 아니면 1 올린다. [횟수, 남은 ms] 를 돌려준다
const INCREMENT_SCRIPT = `
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then
  redis.call('SET', KEYS[1], 1, 'PX', ARGV[1])
  return {1, tonumber(ARGV[1])}
end
return {redis.call('INCR', KEYS[1]), ttl}
`;

// 키가 있을 때만 1 내린다 (만료된 뒤 DECR 로 -1 키가 생기지 않게)
const DECREMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

export class RedisOrMemoryStore implements Store {
  prefix: string;
  private windowMs = 0;
  private memory = new MemoryStore();

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  private redisKey(key: string) {
    return `rl:${this.prefix}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (redis && isRedisReady()) {
      try {
        const [totalHits, ttl] = (await redis.eval(
          INCREMENT_SCRIPT,
          1,
          this.redisKey(key),
          String(this.windowMs)
        )) as [number, number];
        return { totalHits, resetTime: new Date(Date.now() + ttl) };
      } catch {
        // 메모리로 대신 센다
      }
    }
    return this.memory.increment(key);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    if (redis && isRedisReady()) {
      try {
        const [hits, ttl] = await Promise.all([
          redis.get(this.redisKey(key)),
          redis.pttl(this.redisKey(key)),
        ]);
        if (hits === null || ttl <= 0) return undefined;
        return {
          totalHits: Number(hits),
          resetTime: new Date(Date.now() + ttl),
        };
      } catch {
        // 메모리 값으로 대신 답한다
      }
    }
    return this.memory.get(key);
  }

  async decrement(key: string): Promise<void> {
    if (redis && isRedisReady()) {
      try {
        await redis.eval(DECREMENT_SCRIPT, 1, this.redisKey(key));
        return;
      } catch {
        // 메모리 쪽을 내린다
      }
    }
    this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (redis && isRedisReady()) {
      await redis.del(this.redisKey(key)).catch(() => undefined);
    }
    this.memory.resetKey(key);
  }
}
