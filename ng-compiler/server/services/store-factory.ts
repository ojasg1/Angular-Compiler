import { ISessionStore } from './session-store.interface.js';
import { MemorySessionStore } from './memory-store.js';

export async function createSessionStore(): Promise<ISessionStore> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const { default: Redis } = await import('ioredis');
      const { RedisSessionStore } = await import('./redis-store.js');

      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null; // stop retrying
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });

      await redis.connect();
      await redis.ping(); // verify connection

      console.log('[STORE] Connected to Redis at', redisUrl);
      return new RedisSessionStore(redis);
    } catch (err) {
      console.warn('[STORE] Redis unavailable, falling back to in-memory store:', (err as Error).message);
    }
  }

  console.log('[STORE] Using in-memory session store');
  return new MemorySessionStore();
}
