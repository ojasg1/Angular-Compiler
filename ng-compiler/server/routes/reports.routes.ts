import { Router, Request, Response } from 'express';
import { evaluatorAuth } from '../middleware/evaluator-auth.js';
import {
  getCandidateReport,
  getLeaderboard,
  getCohortAnalytics,
  getTestAnalytics,
  getTrendAnalysis,
  getAntiCheatSummary,
} from '../services/reporting.service.js';
import {
  exportCandidatesCsv,
  exportCandidatesJson,
  generateCandidateHtmlReport,
} from '../services/export.service.js';

const router = Router();

// All report endpoints are optionally protected by evaluator API key
router.use(evaluatorAuth);

// GET /api/reports/candidate/:sessionId — Full candidate report
router.get('/candidate/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const report = getCandidateReport(sessionId);
  if (!report) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(report);
});

// GET /api/reports/candidate/:sessionId/pdf — HTML report (printable as PDF)
router.get('/candidate/:sessionId/pdf', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const html = generateCandidateHtmlReport(sessionId);
  if (!html) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.type('html').send(html);
});

// GET /api/reports/leaderboard/:problemId — Ranked candidates
router.get('/leaderboard/:problemId', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const sortBy = (req.query.sortBy as string) || 'score';

  const leaderboard = getLeaderboard(problemId, { limit, offset, sortBy });
  res.json(leaderboard);
});

// GET /api/reports/analytics/:problemId — Cohort analytics
router.get('/analytics/:problemId', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const dateRange = (from || to) ? { from, to } : undefined;

  const analytics = getCohortAnalytics(problemId, dateRange);
  res.json(analytics);
});

// GET /api/reports/analytics/:problemId/tests — Per-test analytics
router.get('/analytics/:problemId/tests', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const tests = getTestAnalytics(problemId);
  res.json(tests);
});

// GET /api/reports/analytics/:problemId/trends — Trend over time
router.get('/analytics/:problemId/trends', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const period = (req.query.period as 'day' | 'week' | 'month') || 'day';
  const trends = getTrendAnalysis(problemId, period);
  res.json(trends);
});

// GET /api/reports/export/:problemId/csv — CSV download
router.get('/export/:problemId/csv', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const dateRange = (from || to) ? { from, to } : undefined;

  const csv = exportCandidatesCsv(problemId, dateRange);
  res.type('text/csv')
    .set('Content-Disposition', `attachment; filename="candidates-${problemId}.csv"`)
    .send(csv);
});

// GET /api/reports/export/:problemId/json — JSON export
router.get('/export/:problemId/json', (req: Request, res: Response) => {
  const problemId = req.params.problemId as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const dateRange = (from || to) ? { from, to } : undefined;

  const data = exportCandidatesJson(problemId, dateRange);
  res.json(data);
});

// GET /api/reports/anti-cheat/:sessionId — Anti-cheat audit
router.get('/anti-cheat/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const summary = getAntiCheatSummary(sessionId);
  res.json(summary);
});

export default router;
