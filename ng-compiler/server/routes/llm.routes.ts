import { Router, Request, Response } from 'express';
import { ISessionStore } from '../services/session-store.interface.js';
import { createSessionAuth } from '../middleware/session-auth.js';
import { saveLlmEvaluation } from '../services/database.service.js';
import { LlmEvalRequest, LlmHintRequest, LlmEvaluation } from '../types.js';

export function createLlmRoutes(store: ISessionStore): Router {
  const router = Router();
  const sessionAuth = createSessionAuth(store);

  function getApiKey(): string {
    return (process.env.ANTHROPIC_API_KEY || '').trim();
  }

  // POST /api/llm/evaluate — Proxy LLM evaluation to Anthropic API
  router.post('/evaluate', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    const apiKey = getApiKey();

    if (!apiKey) {
      res.json(null);
      return;
    }

    if (session.status !== 'submitted') {
      res.status(400).json({ error: 'Assessment must be submitted before evaluation' });
      return;
    }

    const payload = req.body as LlmEvalRequest;

    try {
      const codeContext = payload.codeFiles
        .map(f => `--- ${f.path} ---\n${f.content}`)
        .join('\n\n');

      const testSummary = payload.testSuite.results
        .map(r => `[${r.status.toUpperCase()}] ${r.name} (${r.difficulty}, ${r.testType}, ${r.category || 'structural'})${r.errorMessage ? ' - ' + r.errorMessage : ''}`)
        .join('\n');

      const prompt = `You are an expert Angular code reviewer evaluating a candidate's solution to a coding assessment.

## Problem Description
${payload.problemDescription}

## Candidate's Code
${codeContext}

## Test Results (${payload.testSuite.passed}/${payload.testSuite.total} passed, base score: ${payload.testSuite.score}/${payload.maxScore})
${testSummary}

## Hints Used
The candidate used ${payload.hintsUsed} hint(s) during the assessment.

## Instructions
Evaluate the candidate's code holistically. Consider:
1. Code correctness — does it solve the problem even if some tests fail due to minor issues?
2. Code quality — proper Angular patterns, clean code, good naming
3. Partial credit — if the approach is right but has small bugs, give partial credit
4. Signal usage — proper use of Angular signals and reactive patterns

Return your evaluation as JSON with EXACTLY this format (no markdown, no code fences):
{"adjustedScore": <number 0-${payload.maxScore}>, "reasoning": "<2-3 sentences explaining score adjustment>", "codeQuality": {"maintainability": <1-10>, "reliability": <1-10>, "cyclomaticComplexity": "<low|moderate|high>"}}

Rules:
- adjustedScore should be between 0 and ${payload.maxScore}
- If tests all pass, adjustedScore should be >= base score
- If code is well-written but has minor test failures, you may award partial credit above the raw test score
- If code is poorly structured even though tests pass, you may slightly reduce the score
- Be fair and constructive`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LLM] API error:', response.status, errorText);
        res.json(null);
        return;
      }

      const data = await response.json() as { content?: { text?: string }[] };
      const text = data.content?.[0]?.text || '';

      let jsonStr = text.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      const validComplexity = ['low', 'moderate', 'high'];
      const cq = parsed.codeQuality || {};

      // Clamp adjusted score: can't exceed serverScore + 2 (prevents LLM inflation)
      const serverScore = session.submittedResult?.serverScore ?? payload.testSuite.score;
      const maxAllowed = Math.min(payload.maxScore, serverScore + 2);

      const evaluation: LlmEvaluation = {
        adjustedScore: Math.max(0, Math.min(maxAllowed, Math.round(parsed.adjustedScore))),
        reasoning: parsed.reasoning || 'No reasoning provided.',
        codeQuality: {
          maintainability: Math.max(1, Math.min(10, Math.round(cq.maintainability || 5))),
          reliability: Math.max(1, Math.min(10, Math.round(cq.reliability || 5))),
          cyclomaticComplexity: validComplexity.includes(cq.cyclomaticComplexity) ? cq.cyclomaticComplexity : 'moderate',
        },
      };

      session.llmEvaluation = evaluation;
      await store.set(session);

      // Persist to SQLite
      try {
        if (session.submittedResult?.submissionId) {
          saveLlmEvaluation(session.submittedResult.submissionId, evaluation);
        }
      } catch (dbErr) {
        console.warn('[DB] Failed to persist LLM evaluation:', (dbErr as Error).message);
      }

      console.log(`[LLM] ${session.sessionId}: adjustedScore=${evaluation.adjustedScore} (server=${serverScore}, max=${maxAllowed})`);
      res.json(evaluation);
    } catch (err) {
      console.error('[LLM] Evaluation failed:', err);
      res.json(null);
    }
  });

  // POST /api/llm/hint — Proxy hint requests to Anthropic API
  router.post('/hint', sessionAuth, async (req: Request, res: Response) => {
    const session = req.assessmentSession!;
    const apiKey = getApiKey();

    if (!apiKey) {
      res.json({ hint: 'Check the Angular documentation for the specific API mentioned in the test name.' });
      return;
    }

    if (session.status !== 'active') {
      res.status(400).json({ error: 'Session is not active' });
      return;
    }

    const payload = req.body as LlmHintRequest;

    const levelInstructions = payload.level === 2
      ? 'Give a SPECIFIC hint mentioning the exact Angular API, method name, or pattern the candidate should use. Do NOT give the full answer.'
      : 'Give a near-answer hint with the code STRUCTURE (but not the exact implementation). Show a skeleton/pattern they can fill in.';

    const prompt = `You are helping a candidate who is stuck on an Angular coding assessment.

Test that failed: ${payload.testName}
Error message: ${payload.errorMessage}

Problem description (abbreviated): ${payload.problemDesc.substring(0, 500)}

Candidate's current code (abbreviated): ${payload.code.substring(0, 1000)}

${levelInstructions}

Respond with ONLY the hint text, no markdown formatting, max 2 sentences.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as { content?: { text?: string }[] };
      const hint = data.content?.[0]?.text?.trim() || 'Try reviewing the Angular documentation for this feature.';
      res.json({ hint });
    } catch {
      res.json({
        hint: payload.level === 2
          ? 'Check the Angular documentation for the specific API mentioned in the test name.'
          : 'Look at the test error message carefully — it tells you exactly what value or pattern is expected.',
      });
    }
  });

  return router;
}

export default createLlmRoutes;
