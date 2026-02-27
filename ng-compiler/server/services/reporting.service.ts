import { queryAll, queryOne } from './database.service.js';
import {
  CandidateReport, LeaderboardEntry, CohortAnalytics,
  TestAnalytics, TrendPoint, AntiCheatSummary,
  TestResultPayload, DifficultyBreakdown, LlmEvaluation,
  TestDifficulty, TestCategory,
} from '../types.js';

// --- Individual Candidate Report ---

export function getCandidateReport(sessionId: string): CandidateReport | null {
  const session = queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) return null;

  const submission = queryOne('SELECT * FROM submissions WHERE session_id = ?', [sessionId]);

  let testResults: TestResultPayload[] = [];
  let difficultyBreakdown: DifficultyBreakdown[] = [];
  let codeSnapshot: { path: string; content: string }[] = [];
  let llmEvaluation: LlmEvaluation | null = null;

  if (submission) {
    testResults = queryAll('SELECT * FROM test_results WHERE submission_id = ?', [submission.id]).map((r: any) => ({
      name: r.test_name,
      status: r.status,
      duration: r.duration,
      errorMessage: r.error_message || undefined,
      difficulty: r.difficulty as TestDifficulty,
      testType: r.test_type,
      category: r.category as TestCategory,
      hidden: !!r.hidden,
    }));

    difficultyBreakdown = queryAll('SELECT * FROM difficulty_breakdown WHERE submission_id = ?', [submission.id]).map((b: any) => ({
      difficulty: b.difficulty as TestDifficulty,
      total: b.total,
      passed: b.passed,
      weight: b.weight,
      weightedEarned: b.weighted_earned,
      weightedPossible: b.weighted_possible,
    }));

    codeSnapshot = queryAll('SELECT file_path, content FROM code_snapshots WHERE submission_id = ?', [submission.id]).map((s: any) => ({
      path: s.file_path,
      content: s.content,
    }));

    const llmRow = queryOne('SELECT * FROM llm_evaluations WHERE submission_id = ?', [submission.id]);
    if (llmRow) {
      llmEvaluation = {
        adjustedScore: llmRow.adjusted_score,
        reasoning: llmRow.reasoning,
        codeQuality: {
          maintainability: llmRow.maintainability,
          reliability: llmRow.reliability,
          cyclomaticComplexity: llmRow.cyclomatic_complexity,
        },
      };
    }
  }

  const antiCheatSummary = getAntiCheatSummary(sessionId);

  return {
    session: {
      sessionId: session.id,
      problemId: session.problem_id,
      candidateId: session.candidate_id,
      candidateName: session.candidate_name || undefined,
      candidateEmail: session.candidate_email || undefined,
      status: session.status,
      startTime: session.start_time,
      timeLimit: session.time_limit,
      maxScore: session.max_score,
    },
    submission: submission ? {
      submissionId: submission.id,
      serverScore: submission.server_score,
      adjustedScore: submission.adjusted_score,
      timeTaken: submission.time_taken,
      warnings: JSON.parse(submission.warnings || '[]'),
      antiCheatPenalty: submission.anti_cheat_penalty || 0,
      serverReExecuted: !!submission.server_re_executed,
      testMismatch: !!submission.test_mismatch,
      submittedAt: submission.submitted_at,
    } : null,
    testResults,
    difficultyBreakdown,
    llmEvaluation,
    antiCheatSummary,
    codeSnapshot,
  };
}

// --- Leaderboard ---

export function getLeaderboard(
  problemId: string,
  options: { limit?: number; offset?: number; sortBy?: string } = {},
): LeaderboardEntry[] {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const sortBy = options.sortBy || 'score';

  const allowedSorts: Record<string, string> = {
    'score': 'server_score DESC',
    'time': 'time_taken ASC',
    'date': 'submitted_at DESC',
  };
  const orderClause = allowedSorts[sortBy] || 'server_score DESC';

  const rows = queryAll(`
    SELECT
      s.id as session_id,
      s.candidate_id,
      s.candidate_name,
      s.candidate_email,
      sub.server_score,
      sub.adjusted_score,
      sub.time_taken,
      sub.submitted_at,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.status = 'passed') as tests_passed,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id) as tests_total
    FROM sessions s
    JOIN submissions sub ON sub.session_id = s.id
    WHERE s.problem_id = ?
    ORDER BY ${orderClause}
    LIMIT ? OFFSET ?
  `, [problemId, limit, offset]);

  return rows.map((row: any, idx: number) => ({
    rank: offset + idx + 1,
    sessionId: row.session_id,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name || undefined,
    candidateEmail: row.candidate_email || undefined,
    serverScore: row.server_score,
    adjustedScore: row.adjusted_score,
    timeTaken: row.time_taken,
    testPassRate: row.tests_total > 0 ? row.tests_passed / row.tests_total : 0,
    submittedAt: row.submitted_at,
  }));
}

// --- Cohort Analytics ---

export function getCohortAnalytics(
  problemId: string,
  dateRange?: { from?: string; to?: string },
): CohortAnalytics {
  let dateFilter = '';
  const params: any[] = [problemId];
  if (dateRange?.from) {
    dateFilter += ' AND sub.submitted_at >= ?';
    params.push(dateRange.from);
  }
  if (dateRange?.to) {
    dateFilter += ' AND sub.submitted_at <= ?';
    params.push(dateRange.to);
  }

  // Basic stats
  const stats = queryOne(`
    SELECT
      COUNT(*) as total,
      AVG(sub.server_score) as avg_score,
      AVG(sub.time_taken) as avg_time
    FROM sessions s
    JOIN submissions sub ON sub.session_id = s.id
    WHERE s.problem_id = ? ${dateFilter}
  `, params);

  const totalSessions = queryOne('SELECT COUNT(*) as cnt FROM sessions WHERE problem_id = ?', [problemId]);

  // Get all scores for percentile calculations
  const scores = queryAll(`
    SELECT sub.server_score
    FROM sessions s
    JOIN submissions sub ON sub.session_id = s.id
    WHERE s.problem_id = ? ${dateFilter}
    ORDER BY sub.server_score ASC
  `, params);

  const scoreValues = scores.map((s: any) => s.server_score);

  function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const idx = Math.ceil(arr.length * p / 100) - 1;
    return arr[Math.max(0, idx)];
  }

  function stdDev(arr: number[], mean: number): number {
    if (arr.length === 0) return 0;
    const sumSqDiff = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    return Math.sqrt(sumSqDiff / arr.length);
  }

  // Difficulty analysis
  const difficultyAnalysis = queryAll(`
    SELECT
      tr.difficulty,
      CAST(SUM(CASE WHEN tr.status = 'passed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as pass_rate,
      AVG(CASE WHEN tr.status = 'passed' THEN 1.0 ELSE 0.0 END) * 100 as avg_score
    FROM test_results tr
    JOIN submissions sub ON sub.id = tr.submission_id
    JOIN sessions s ON s.id = sub.session_id
    WHERE s.problem_id = ? ${dateFilter}
    GROUP BY tr.difficulty
  `, params);

  // Test discrimination (simplified)
  const testDiscrimination = getTestDiscrimination(problemId, params, dateFilter);

  return {
    totalCandidates: stats?.total || 0,
    averageScore: stats?.avg_score || 0,
    medianScore: percentile(scoreValues, 50),
    stdDeviation: stdDev(scoreValues, stats?.avg_score || 0),
    percentileDistribution: {
      p10: percentile(scoreValues, 10),
      p25: percentile(scoreValues, 25),
      p50: percentile(scoreValues, 50),
      p75: percentile(scoreValues, 75),
      p90: percentile(scoreValues, 90),
    },
    averageTimeTaken: stats?.avg_time || 0,
    completionRate: totalSessions?.cnt > 0 ? (stats?.total || 0) / totalSessions.cnt : 0,
    difficultyAnalysis: difficultyAnalysis.map((d: any) => ({
      difficulty: d.difficulty as TestDifficulty,
      passRate: d.pass_rate,
      avgScore: d.avg_score,
    })),
    testDiscrimination,
  };
}

function getTestDiscrimination(
  problemId: string,
  params: any[],
  dateFilter: string,
): CohortAnalytics['testDiscrimination'] {
  // Get all candidate scores
  const candidateScores = queryAll(`
    SELECT sub.id as submission_id, sub.server_score
    FROM submissions sub
    JOIN sessions s ON s.id = sub.session_id
    WHERE s.problem_id = ? ${dateFilter}
    ORDER BY sub.server_score DESC
  `, params);

  if (candidateScores.length < 4) return [];

  const n = candidateScores.length;
  const cutoff = Math.ceil(n * 0.27);
  const topGroup = new Set(candidateScores.slice(0, cutoff).map((c: any) => c.submission_id));
  const bottomGroup = new Set(candidateScores.slice(-cutoff).map((c: any) => c.submission_id));

  // Get unique test names
  const tests = queryAll(`
    SELECT DISTINCT tr.test_name, tr.difficulty
    FROM test_results tr
    JOIN submissions sub ON sub.id = tr.submission_id
    JOIN sessions s ON s.id = sub.session_id
    WHERE s.problem_id = ?
  `, [problemId]);

  return tests.map((test: any) => {
    const allResults = queryAll(`
      SELECT tr.submission_id, tr.status
      FROM test_results tr
      JOIN submissions sub ON sub.id = tr.submission_id
      JOIN sessions s ON s.id = sub.session_id
      WHERE s.problem_id = ? AND tr.test_name = ?
    `, [problemId, test.test_name]);

    const topPassed = allResults.filter((r: any) => topGroup.has(r.submission_id) && r.status === 'passed').length;
    const topTotal = allResults.filter((r: any) => topGroup.has(r.submission_id)).length;
    const bottomPassed = allResults.filter((r: any) => bottomGroup.has(r.submission_id) && r.status === 'passed').length;
    const bottomTotal = allResults.filter((r: any) => bottomGroup.has(r.submission_id)).length;

    const topRate = topTotal > 0 ? topPassed / topTotal : 0;
    const bottomRate = bottomTotal > 0 ? bottomPassed / bottomTotal : 0;
    const totalPassed = allResults.filter((r: any) => r.status === 'passed').length;

    return {
      testName: test.test_name,
      passRate: allResults.length > 0 ? totalPassed / allResults.length : 0,
      difficulty: test.difficulty as TestDifficulty,
      discriminationIndex: topRate - bottomRate,
    };
  });
}

// --- Per-Test Analytics ---

export function getTestAnalytics(problemId: string): TestAnalytics[] {
  const tests = queryAll(`
    SELECT
      tr.test_name,
      tr.difficulty,
      tr.category,
      CAST(SUM(CASE WHEN tr.status = 'passed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as pass_rate,
      AVG(tr.duration) as avg_duration,
      COUNT(*) as total_attempts
    FROM test_results tr
    JOIN submissions sub ON sub.id = tr.submission_id
    JOIN sessions s ON s.id = sub.session_id
    WHERE s.problem_id = ?
    GROUP BY tr.test_name
  `, [problemId]);

  return tests.map((t: any) => ({
    testName: t.test_name,
    passRate: t.pass_rate,
    avgDuration: t.avg_duration,
    discriminationIndex: 0, // Would need full calculation
    difficultyIndex: 1 - t.pass_rate, // Higher = harder
    difficulty: t.difficulty as TestDifficulty,
    category: t.category as TestCategory,
  }));
}

// --- Trend Analysis ---

export function getTrendAnalysis(
  problemId: string,
  period: 'day' | 'week' | 'month' = 'day',
): TrendPoint[] {
  const dateFormat: Record<string, string> = {
    day: '%Y-%m-%d',
    week: '%Y-W%W',
    month: '%Y-%m',
  };

  const rows = queryAll(`
    SELECT
      strftime('${dateFormat[period]}', sub.submitted_at) as date,
      COUNT(*) as candidate_count,
      AVG(sub.server_score) as avg_score,
      CAST(SUM(CASE WHEN sub.server_score > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as pass_rate
    FROM submissions sub
    JOIN sessions s ON s.id = sub.session_id
    WHERE s.problem_id = ?
    GROUP BY date
    ORDER BY date ASC
  `, [problemId]);

  return rows.map((r: any) => ({
    date: r.date,
    candidateCount: r.candidate_count,
    avgScore: r.avg_score,
    passRate: r.pass_rate,
  }));
}

// --- Anti-Cheat Summary ---

export function getAntiCheatSummary(sessionId: string): AntiCheatSummary {
  const events = queryAll(
    'SELECT * FROM anti_cheat_events WHERE session_id = ? ORDER BY server_timestamp ASC',
    [sessionId],
  );

  const byType: Record<string, number> = {};
  const timeline = events.map((e: any) => {
    byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    return {
      type: e.event_type,
      timestamp: e.client_timestamp,
      serverTimestamp: e.server_timestamp,
      metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
    };
  });

  const submission = queryOne(
    'SELECT anti_cheat_penalty FROM submissions WHERE session_id = ?',
    [sessionId],
  );

  return {
    totalEvents: events.length,
    byType,
    timeline,
    penaltyApplied: submission?.anti_cheat_penalty || 0,
  };
}
