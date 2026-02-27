import { Session, AuditEvent } from '../types.js';
import { ISessionStore } from './session-store.interface.js';

export class MemorySessionStore implements ISessionStore {
  private sessions = new Map<string, Session>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours
      for (const [id, session] of this.sessions) {
        if (session.startTime < cutoff) {
          this.sessions.delete(id);
        }
      }
    }, 5 * 60 * 1000);
  }

  async get(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async addEvent(sessionId: string, event: AuditEvent): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events.push(event);
    }
  }

  async addHeartbeat(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.heartbeats.push(Date.now());
    }
  }

  async getAll(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  getStoreType(): 'redis' | 'memory' {
    return 'memory';
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
