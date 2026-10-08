import Redis from 'ioredis';
import { ENV } from '../config/env';

/*=================================================
Redis 클라이언트 (캐시 전용)
=================================================*/
/*
@ 가이드
- REDIS_URL 이 없으면 redis 는 null 이고, 캐시 없이 DB 를 직접 조회한다
@ 주의사항
- enableOfflineQueue: false — 연결이 끊긴 동안 명령을 쌓아두지 않고 바로 실패시킨다.
  켜 두면 Redis 장애 시 요청이 재연결을 기다리며 멈춘다
- error 핸들러가 없으면 연결 오류 이벤트로 프로세스가 종료된다
*/
export const redis = ENV.REDIS_URL
  ? new Redis(ENV.REDIS_URL, { enableOfflineQueue: false })
  : null;

// 재연결을 계속 시도하며 같은 에러가 반복되므로, 끊길 때 한 번만 남긴다
let hasLoggedError = false;

redis?.on('error', (error: unknown) => {
  if (hasLoggedError) return;
  hasLoggedError = true;
  console.error('[redis] 연결 오류, 재연결 전까지 캐시 없이 동작합니다', error);
});

redis?.on('ready', () => {
  if (hasLoggedError)
    console.warn('[redis] 재연결 완료, 캐시를 다시 사용합니다');
  hasLoggedError = false;
});

export const isRedisReady = () => redis?.status === 'ready';

/*
@ deleteCacheByPrefix
- prefix 로 시작하는 캐시 키를 전부 지운다. 예) 'cache:/mover' → 목록·상세 캐시 전체
- KEYS 대신 SCAN 이라 Redis 를 막지 않는다
- DB 쓰기가 성공한 "뒤"에 호출한다. 실패해도 throw 하지 않는다 (TTL 이 안전망)
*/
export const deleteCacheByPrefix = async (prefix: string) => {
  if (!redis || !isRedisReady()) return;

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100
      );
      if (keys.length > 0) await redis.del(...keys);
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (error: unknown) {
    console.error('[redis] 캐시 삭제 실패', error);
  }
};
