import { Session, AuditEvent } from '../types.js';

export interface ISessionStore {
  get(sessionId: string): Promise<Session | undefined>;
  set(session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  addEvent(sessionId: string, event: AuditEvent): Promise<void>;
  addHeartbeat(sessionId: string): Promise<void>;
  getAll(): Promise<Session[]>;
  getStoreType(): 'redis' | 'memory';
}
