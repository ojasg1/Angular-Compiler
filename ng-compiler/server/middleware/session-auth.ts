import { Request, Response, NextFunction } from 'express';
import { ISessionStore } from '../services/session-store.interface.js';
import { isExpired } from '../services/session-store.js';
import { Session } from '../types.js';

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      assessmentSession?: Session;
    }
  }
}

export function createSessionAuth(store: ISessionStore) {
  return async function sessionAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      res.status(401).json({ error: 'Missing x-session-id header' });
      return;
    }

    const session = await store.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Auto-expire if time is up
    if (session.status === 'active' && isExpired(session)) {
      session.status = 'expired';
      await store.set(session);
    }

    req.assessmentSession = session;
    next();
  };
}
