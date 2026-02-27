import { Router, Request, Response } from 'express';
import { ISessionStore } from '../services/session-store.interface.js';
import { createSessionAuth } from '../middleware/session-auth.js';
import { verifyHmac, verifySignature } from '../services/crypto.service.js';
import { calculateWeightedScore, calculateAntiCheatPenalty } from '../services/scoring.service.js';
import { getRemainingSeconds } from '../services/session-store.js';
import { executeTestsServerSide } from '../services/test-executor.service.js';
import { saveSubmission, updateSessionStatus } from '../services/database.service.js';
import { SubmitPayload, SubmissionResult } from '../types.js';
import crypto from 'crypto';

export function createSubmitRoutes(store: ISessionStore): Router {
  const router = Router();
  const sessionAuth = createSessionAuth(store);

  // POST /api/submit — Receive and verify test results
  router.post('/', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    const payload = req.body as SubmitPayload;
    const warnings: string[] = [];

    // 1. Validate session is active
    if (session.status === 'submitted') {
      res.status(409).json({ error: 'Assessment already submitted' });
      return;
    }

    // 2. Check timing (30s grace period for network latency)
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const graceSeconds = 30;
    if (elapsed > session.timeLimit + graceSeconds) {
      warnings.push(`Late submission: ${elapsed - session.timeLimit}s over time limit`);
    }

    // 3. Verify signature — try Ed25519 first, fall back to HMAC
    let signatureValid = false;
    if (payload.signature && payload.nonce) {
      const testResultsJson = JSON.stringify({
        total: payload.testResults.total,
        passed: payload.testResults.passed,
        failed: payload.testResults.failed,
        results: payload.testResults.results,
      });

      // Try Ed25519 verification
      const ed25519Payload = payload.nonce + testResultsJson;
      if (session.publicKey) {
        signatureValid = verifySignature(session.publicKey, ed25519Payload, payload.signature);
      }

      // Fall back to HMAC
      if (!signatureValid) {
        const hmacPayload = payload.nonce + testResultsJson;
        signatureValid = verifyHmac(session.hmacKey, hmacPayload, payload.signature);
      }

      if (!signatureValid) {
        warnings.push('Signature verification failed — results may have been tampered with');
        console.log(`[SECURITY] ${session.sessionId}: Signature verification FAILED`);
      } else {
        console.log(`[SECURITY] ${session.sessionId}: Signature verification passed`);
      }
    } else {
      warnings.push('No signature provided — results are unverified');
    }

    // 4. Cross-validate test count
    const structBehavCount = payload.testResults.results.length;
    if (structBehavCount !== session.expectedTestCount) {
      warnings.push(`Expected ${session.expectedTestCount} structural/behavioral tests, got ${structBehavCount}`);
    }

    // 5. Check DOM test results for suspicious patterns
    if (payload.domTestResults && payload.domTestResults.length > 0) {
      const allPassZeroDuration = payload.domTestResults.every(r => r.status === 'passed' && r.duration === 0);
      if (allPassZeroDuration) {
        warnings.push('Suspicious: All DOM tests passed with 0ms duration');
      }
    }

    // 6. Combine all results and recalculate score server-side
    const allResults = [
      ...payload.testResults.results,
      ...(payload.domTestResults || []),
    ];
    const { score, difficultyBreakdown } = calculateWeightedScore(allResults);

    // 7. Server-side test re-execution
    let serverReExecuted = false;
    let serverTestResults = null;
    let testMismatch = false;

    if (payload.codeSnapshot && payload.codeSnapshot.length > 0) {
      try {
        const serverExec = executeTestsServerSide(payload.codeSnapshot, session.problemId);
        serverReExecuted = true;
        serverTestResults = serverExec.results;

        // Compare server vs client results
        const serverPassed = serverExec.results.filter(r => r.status === 'passed').length;
        const clientPassed = payload.testResults.results.filter(r => r.status === 'passed').length;

        if (serverPassed !== clientPassed) {
          testMismatch = true;
          warnings.push(`Test mismatch: client reported ${clientPassed} passed, server found ${serverPassed} passed`);
          console.log(`[REEXEC] ${session.sessionId}: MISMATCH — client=${clientPassed}, server=${serverPassed}`);
        } else {
          console.log(`[REEXEC] ${session.sessionId}: Results match (${serverPassed} passed)`);
        }
      } catch (err) {
        warnings.push(`Server re-execution failed: ${(err as Error).message}`);
        console.error(`[REEXEC] ${session.sessionId}: Error:`, (err as Error).message);
      }
    }

    // 8. Calculate anti-cheat penalty
    const { penaltyPercent, breakdown: penaltyBreakdown } = calculateAntiCheatPenalty(session.events);
    const penaltyMultiplier = 1 - (penaltyPercent / 100);
    const adjustedScore = Math.round(score * penaltyMultiplier * 100) / 100;

    if (penaltyPercent > 0) {
      warnings.push(`Anti-cheat penalty applied: ${penaltyPercent}% (${JSON.stringify(penaltyBreakdown)})`);
      console.log(`[ANTI-CHEAT] ${session.sessionId}: Penalty ${penaltyPercent}%`);
    }

    // 9. Store result
    const submissionId = crypto.randomUUID();
    const result: SubmissionResult = {
      serverScore: adjustedScore,
      serverTimestamp: Date.now(),
      timeTaken: elapsed,
      warnings,
      submissionId,
      difficultyBreakdown,
      testResults: allResults,
      serverReExecuted,
      serverTestResults,
      testMismatch,
      antiCheatPenalty: penaltyPercent,
    };

    session.status = 'submitted';
    session.submittedResult = result;
    session.codeSnapshot = payload.codeSnapshot || null;
    session.antiCheatPenalty = penaltyPercent;
    await store.set(session);

    // Persist to SQLite
    try {
      saveSubmission(session, result, payload.codeSnapshot || null);
    } catch (dbErr) {
      console.warn('[DB] Failed to persist submission:', (dbErr as Error).message);
    }

    console.log(`[SUBMIT] ${session.sessionId}: score=${adjustedScore}/${session.maxScore}, time=${elapsed}s, warnings=${warnings.length}`);

    if (warnings.length > 0) {
      console.log(`[SUBMIT] Warnings:`, warnings);
    }

    res.json(result);
  });

  return router;
}

export default createSubmitRoutes;
