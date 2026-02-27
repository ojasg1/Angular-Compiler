import { Request, Response, NextFunction } from 'express';

const windowMs = 60 * 1000; // 1 minute
const maxRequests = 60;
const requestLog = new Map<string, number[]>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of requestLog) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, filtered);
    }
  }
}, 5 * 60 * 1000);

let redisClient: any = null;

export function setRedisClient(client: any): void {
  redisClient = client;
}

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = (req.headers['x-session-id'] as string) || req.ip || 'unknown';
  const now = Date.now();

  // Use Redis ZSET if available
  if (redisClient) {
    try {
      const redisKey = `ratelimit:${key}`;
      const cutoff = now - windowMs;

      await redisClient.zremrangebyscore(redisKey, 0, cutoff);
      const count = await redisClient.zcard(redisKey);

      if (count >= maxRequests) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }

      await redisClient.zadd(redisKey, now, `${now}:${Math.random()}`);
      await redisClient.expire(redisKey, 120);
      next();
      return;
    } catch {
      // Fall through to in-memory rate limiting
    }
  }

  // In-memory fallback
  const cutoff = now - windowMs;
  const timestamps = requestLog.get(key) || [];
  const recent = timestamps.filter(t => t > cutoff);

  if (recent.length >= maxRequests) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  recent.push(now);
  requestLog.set(key, recent);
  next();
}
