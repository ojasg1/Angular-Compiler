import Redis from 'ioredis';
import { Session, AuditEvent } from '../types.js';
import { ISessionStore } from './session-store.interface.js';

const SESSION_TTL = 7200; // 2 hours in seconds
const KEY_PREFIX = 'session:';

export class RedisSessionStore implements ISessionStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(sessionId: string): string {
    return KEY_PREFIX + sessionId;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const data = await this.redis.get(this.key(sessionId));
    if (!data) return undefined;
    return JSON.parse(data) as Session;
  }

  async set(session: Session): Promise<void> {
    await this.redis.setex(
      this.key(session.sessionId),
      SESSION_TTL,
      JSON.stringify(session),
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  async addEvent(sessionId: string, event: AuditEvent): Promise<void> {
    const session = await this.get(sessionId);
    if (session) {
      session.events.push(event);
      await this.set(session);
    }
  }

  async addHeartbeat(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (session) {
      session.heartbeats.push(Date.now());
      await this.set(session);
    }
  }

  async getAll(): Promise<Session[]> {
    const keys = await this.redis.keys(KEY_PREFIX + '*');
    if (keys.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();
    if (!results) return [];

    const sessions: Session[] = [];
    for (const [err, data] of results) {
      if (!err && data) {
        sessions.push(JSON.parse(data as string) as Session);
      }
    }
    return sessions;
  }

  getStoreType(): 'redis' | 'memory' {
    return 'redis';
  }

  getRedisClient(): Redis {
    return this.redis;
  }
}
