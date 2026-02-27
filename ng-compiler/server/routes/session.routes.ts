import { Router, Request, Response } from 'express';
import { getManifest, getRemainingSeconds } from '../services/session-store.js';
import { ISessionStore } from '../services/session-store.interface.js';
import { createSessionAuth } from '../middleware/session-auth.js';
import {
  generateNonce, generateHmacKey, generateSessionId,
  generateKeyPair, generateEncryptionKey,
} from '../services/crypto.service.js';
import { encryptSpecs } from '../services/test-encryption.service.js';
import { PROBLEM_TEST_SPECS } from '../data/test-specs.js';
import { saveSession, saveAntiCheatEvent } from '../services/database.service.js';
import {
  Session, SessionStartRequest, SessionStartResponse,
  HeartbeatResponse, EventRequest,
} from '../types.js';

export function createSessionRoutes(store: ISessionStore): Router {
  const router = Router();
  const sessionAuth = createSessionAuth(store);

  // POST /api/session/start — Create new assessment session
  router.post('/start', async (req: Request, res: Response) => {
    const { problemId, candidateId, candidateName, candidateEmail } = req.body as SessionStartRequest;

    if (!problemId) {
      res.status(400).json({ error: 'problemId is required' });
      return;
    }

    const manifest = getManifest(problemId);
    if (!manifest) {
      res.status(400).json({ error: `Unknown problem: ${problemId}` });
      return;
    }

    try {
      const keyPair = generateKeyPair();
      const encryptionKey = generateEncryptionKey();

      // Encrypt test specs
      const specs = PROBLEM_TEST_SPECS[problemId];
      const encryptedSpecs = specs
        ? encryptSpecs(encryptionKey, JSON.stringify(specs))
        : encryptSpecs(encryptionKey, '[]');

      const session: Session = {
        sessionId: generateSessionId(),
        problemId,
        candidateId: candidateId || 'anonymous',
        candidateName,
        candidateEmail,
        nonce: generateNonce(),
        hmacKey: generateHmacKey(),
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        encryptionKey,
        executionNonce: generateNonce(),
        startTime: Date.now(),
        timeLimit: manifest.timeLimit,
        maxScore: manifest.maxScore,
        expectedTestCount: manifest.expectedTestCount,
        status: 'active',
        events: [],
        heartbeats: [],
        testRunCount: 0,
        submittedResult: null,
        codeSnapshot: null,
        llmEvaluation: null,
        antiCheatPenalty: 0,
      };

      await store.set(session);

      // Persist to SQLite
      try {
        saveSession(session);
      } catch (dbErr) {
        console.warn('[DB] Failed to persist session:', (dbErr as Error).message);
      }

      const response: SessionStartResponse = {
        sessionId: session.sessionId,
        nonce: session.nonce,
        hmacKey: session.hmacKey,
        privateKey: session.privateKey,
        encryptionKey,
        encryptedSpecs,
        serverStartTime: session.startTime,
        timeLimit: session.timeLimit,
      };

      console.log(`[SESSION] Created ${session.sessionId} for problem "${problemId}" (candidate: ${session.candidateId})`);
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/session/challenge — Issue fresh nonce for test run
  router.post('/challenge', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    session.executionNonce = generateNonce();
    await store.set(session);
    res.json({ executionNonce: session.executionNonce });
  });

  // POST /api/session/heartbeat — Sync timer
  router.post('/heartbeat', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    const { clientRemaining } = req.body as { clientRemaining?: number };

    await store.addHeartbeat(session.sessionId);
    const serverRemaining = getRemainingSeconds(session);

    // Auto-expire
    if (serverRemaining <= 0 && session.status === 'active') {
      session.status = 'expired';
      await store.set(session);
      console.log(`[SESSION] ${session.sessionId} expired (server timer)`);
    }

    const drift = clientRemaining !== undefined ? Math.abs(clientRemaining - serverRemaining) : 0;

    const response: HeartbeatResponse = {
      serverRemainingSeconds: serverRemaining,
      status: session.status === 'active' ? 'active' : 'expired',
      drift,
    };

    res.json(response);
  });

  // POST /api/session/event — Log anti-cheat events
  router.post('/event', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    const event = req.body as EventRequest;

    if (!event.type) {
      res.status(400).json({ error: 'Event type is required' });
      return;
    }

    const auditEvent = {
      type: event.type,
      timestamp: event.timestamp || Date.now(),
      serverTimestamp: Date.now(),
      metadata: event.metadata,
    };

    await store.addEvent(session.sessionId, auditEvent);

    // Persist to SQLite
    try {
      saveAntiCheatEvent(session.sessionId, auditEvent);
    } catch (dbErr) {
      // Non-critical — don't fail the request
    }

    if (event.type === 'test_run') {
      session.testRunCount++;
      await store.set(session);
    }

    // Log notable events
    if (['devtools_open', 'tab_blur', 'copy', 'paste', 'large_paste', 'frequent_tab_switching', 'keyboard_shortcut_blocked'].includes(event.type)) {
      console.log(`[ANTI-CHEAT] ${session.sessionId}: ${event.type}`);
    }

    res.json({ received: true });
  });

  // GET /api/session/:id/result — Retrieve session result
  router.get('/:id/result', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await store.get(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      sessionId: session.sessionId,
      problemId: session.problemId,
      candidateId: session.candidateId,
      status: session.status,
      startTime: session.startTime,
      timeLimit: session.timeLimit,
      maxScore: session.maxScore,
      testRunCount: session.testRunCount,
      events: session.events,
      submittedResult: session.submittedResult,
      llmEvaluation: session.llmEvaluation,
      codeSnapshot: session.codeSnapshot,
    });
  });

  return router;
}

export default createSessionRoutes;
