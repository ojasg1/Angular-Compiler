import { queryAll } from './database.service.js';
import { getCandidateReport } from './reporting.service.js';

// --- CSV Export ---

export function exportCandidatesCsv(
  problemId: string,
  dateRange?: { from?: string; to?: string },
): string {
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

  const rows = queryAll(`
    SELECT
      s.candidate_id,
      s.candidate_email,
      s.candidate_name,
      sub.server_score,
      sub.adjusted_score,
      sub.time_taken,
      sub.anti_cheat_penalty,
      sub.server_re_executed,
      sub.test_mismatch,
      sub.warnings,
      sub.submitted_at,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.status = 'passed' AND tr.difficulty = 'easy') as easy_passed,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.difficulty = 'easy') as easy_total,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.status = 'passed' AND tr.difficulty = 'medium') as medium_passed,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.difficulty = 'medium') as medium_total,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.status = 'passed' AND tr.difficulty = 'hard') as hard_passed,
      (SELECT COUNT(*) FROM test_results tr WHERE tr.submission_id = sub.id AND tr.difficulty = 'hard') as hard_total
    FROM sessions s
    JOIN submissions sub ON sub.session_id = s.id
    WHERE s.problem_id = ? ${dateFilter}
    ORDER BY sub.server_score DESC
  `, params);

  const headers = [
    'candidateId', 'email', 'name', 'score', 'adjustedScore', 'timeTaken',
    'easyPassed', 'easyTotal', 'mediumPassed', 'mediumTotal', 'hardPassed', 'hardTotal',
    'antiCheatPenalty', 'warnings', 'submittedAt',
  ];

  const csvRows = rows.map((row: any) => [
    escapeCsv(row.candidate_id),
    escapeCsv(row.candidate_email || ''),
    escapeCsv(row.candidate_name || ''),
    row.server_score,
    row.adjusted_score ?? '',
    row.time_taken,
    row.easy_passed,
    row.easy_total,
    row.medium_passed,
    row.medium_total,
    row.hard_passed,
    row.hard_total,
    row.anti_cheat_penalty || 0,
    escapeCsv(row.warnings || '[]'),
    escapeCsv(row.submitted_at),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

// --- JSON Export ---

export function exportCandidatesJson(
  problemId: string,
  dateRange?: { from?: string; to?: string },
): object[] {
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

  const rows = queryAll(`
    SELECT s.id as session_id, s.candidate_id, s.candidate_email, s.candidate_name,
      sub.server_score, sub.adjusted_score, sub.time_taken, sub.anti_cheat_penalty,
      sub.server_re_executed, sub.test_mismatch, sub.warnings, sub.submitted_at
    FROM sessions s
    JOIN submissions sub ON sub.session_id = s.id
    WHERE s.problem_id = ? ${dateFilter}
    ORDER BY sub.server_score DESC
  `, params);

  return rows.map((row: any) => ({
    sessionId: row.session_id,
    candidateId: row.candidate_id,
    candidateEmail: row.candidate_email,
    candidateName: row.candidate_name,
    serverScore: row.server_score,
    adjustedScore: row.adjusted_score,
    timeTaken: row.time_taken,
    antiCheatPenalty: row.anti_cheat_penalty,
    serverReExecuted: !!row.server_re_executed,
    testMismatch: !!row.test_mismatch,
    warnings: JSON.parse(row.warnings || '[]'),
    submittedAt: row.submitted_at,
  }));
}

// --- HTML Report (for PDF-like output) ---

export function generateCandidateHtmlReport(sessionId: string): string | null {
  const report = getCandidateReport(sessionId);
  if (!report) return null;

  const sub = report.submission;
  const llm = report.llmEvaluation;
  const ac = report.antiCheatSummary;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Candidate Report - ${report.session.candidateId}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; color: #333; }
  h1 { color: #1a1a2e; border-bottom: 2px solid #0066cc; padding-bottom: 0.5rem; }
  h2 { color: #16213e; margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f4f4f4; }
  .passed { color: #28a745; font-weight: bold; }
  .failed { color: #dc3545; font-weight: bold; }
  .score-box { background: #f0f7ff; border: 1px solid #0066cc; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; display: inline-block; }
  .score-value { font-size: 2rem; font-weight: bold; color: #0066cc; }
  .warning { color: #856404; background: #fff3cd; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0; }
  .meta { color: #666; font-size: 0.9rem; }
  pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.85rem; }
  .footer { margin-top: 3rem; color: #999; font-size: 0.8rem; border-top: 1px solid #eee; padding-top: 1rem; }
</style>
</head>
<body>
<h1>Candidate Assessment Report</h1>

<h2>Session Information</h2>
<table>
  <tr><th>Session ID</th><td class="meta">${report.session.sessionId}</td></tr>
  <tr><th>Problem</th><td>${report.session.problemId}</td></tr>
  <tr><th>Candidate ID</th><td>${report.session.candidateId}</td></tr>
  ${report.session.candidateName ? `<tr><th>Name</th><td>${escapeHtml(report.session.candidateName)}</td></tr>` : ''}
  ${report.session.candidateEmail ? `<tr><th>Email</th><td>${escapeHtml(report.session.candidateEmail)}</td></tr>` : ''}
  <tr><th>Status</th><td>${report.session.status}</td></tr>
  <tr><th>Time Limit</th><td>${report.session.timeLimit}s</td></tr>
</table>

${sub ? `
<h2>Score Summary</h2>
<div class="score-box">
  <div class="score-value">${sub.serverScore} / ${report.session.maxScore}</div>
  <div class="meta">Server-verified score</div>
  ${sub.adjustedScore !== null ? `<div class="meta">LLM-adjusted: ${sub.adjustedScore}</div>` : ''}
  ${sub.antiCheatPenalty > 0 ? `<div class="warning">Anti-cheat penalty: ${sub.antiCheatPenalty}%</div>` : ''}
</div>
<p class="meta">Time taken: ${sub.timeTaken}s | Submitted: ${sub.submittedAt}</p>

${sub.warnings.length > 0 ? `
<h3>Warnings</h3>
${sub.warnings.map((w: string) => `<div class="warning">${escapeHtml(w)}</div>`).join('\n')}
` : ''}

<h2>Test Results</h2>
<table>
  <tr><th>Test</th><th>Status</th><th>Difficulty</th><th>Category</th><th>Duration</th></tr>
  ${report.testResults.map(t => `
  <tr>
    <td>${escapeHtml(t.name)}</td>
    <td class="${t.status}">${t.status.toUpperCase()}</td>
    <td>${t.difficulty}</td>
    <td>${t.category || 'structural'}</td>
    <td>${t.duration}ms</td>
  </tr>
  ${t.errorMessage ? `<tr><td colspan="5" style="color:#dc3545;font-size:0.85rem;">Error: ${escapeHtml(t.errorMessage)}</td></tr>` : ''}
  `).join('')}
</table>

<h2>Difficulty Breakdown</h2>
<table>
  <tr><th>Difficulty</th><th>Passed</th><th>Total</th><th>Weight</th><th>Weighted Score</th></tr>
  ${report.difficultyBreakdown.map(d => `
  <tr>
    <td>${d.difficulty}</td>
    <td>${d.passed}</td>
    <td>${d.total}</td>
    <td>${d.weight}x</td>
    <td>${d.weightedEarned} / ${d.weightedPossible}</td>
  </tr>
  `).join('')}
</table>
` : '<p class="meta">No submission recorded.</p>'}

${llm ? `
<h2>LLM Evaluation</h2>
<table>
  <tr><th>Adjusted Score</th><td>${llm.adjustedScore}</td></tr>
  <tr><th>Reasoning</th><td>${escapeHtml(llm.reasoning)}</td></tr>
  <tr><th>Maintainability</th><td>${llm.codeQuality.maintainability}/10</td></tr>
  <tr><th>Reliability</th><td>${llm.codeQuality.reliability}/10</td></tr>
  <tr><th>Cyclomatic Complexity</th><td>${llm.codeQuality.cyclomaticComplexity}</td></tr>
</table>
` : ''}

<h2>Anti-Cheat Summary</h2>
<table>
  <tr><th>Total Events</th><td>${ac.totalEvents}</td></tr>
  ${Object.entries(ac.byType).map(([type, count]) => `<tr><th>${type}</th><td>${count}</td></tr>`).join('')}
  <tr><th>Penalty Applied</th><td>${ac.penaltyApplied}%</td></tr>
</table>

${report.codeSnapshot.length > 0 ? `
<h2>Code Snapshots</h2>
${report.codeSnapshot.map(f => `
<h3>${escapeHtml(f.path)}</h3>
<pre>${escapeHtml(f.content)}</pre>
`).join('')}
` : ''}

<div class="footer">
  Generated by iMocha Assessment Platform | ${new Date().toISOString()}
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
