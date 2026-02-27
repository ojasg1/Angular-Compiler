import initSqlJs, { Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  Session, SubmissionResult, LlmEvaluation, AuditEvent,
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database;
let dbPath: string;

function persistDb(): void {
  try {
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.warn('[DB] Failed to persist database:', (err as Error).message);
  }
}

// Auto-persist every 30 seconds
let persistInterval: ReturnType<typeof setInterval>;

export async function initDatabase(): Promise<void> {
  dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'assessments.db');

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      candidate_name TEXT,
      candidate_email TEXT,
      status TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      time_limit INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      server_score REAL NOT NULL,
      adjusted_score REAL,
      time_taken INTEGER NOT NULL,
      warnings TEXT,
      anti_cheat_penalty REAL DEFAULT 0,
      server_re_executed INTEGER DEFAULT 0,
      test_mismatch INTEGER DEFAULT 0,
      submitted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(session_id)
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration REAL,
      error_message TEXT,
      difficulty TEXT NOT NULL,
      category TEXT NOT NULL,
      test_type TEXT,
      hidden INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS difficulty_breakdown (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      weighted_earned REAL NOT NULL,
      weighted_possible REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL,
      adjusted_score REAL,
      reasoning TEXT,
      maintainability REAL,
      reliability REAL,
      cyclomatic_complexity TEXT,
      evaluated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(submission_id)
    );

    CREATE TABLE IF NOT EXISTS anti_cheat_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      client_timestamp INTEGER,
      server_timestamp INTEGER,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS code_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL
    );
  `);

  // Create indexes (IF NOT EXISTS not supported for indexes in all SQLite, use try)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_problem ON sessions(problem_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON sessions(candidate_email)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(server_score)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(submitted_at)',
    'CREATE INDEX IF NOT EXISTS idx_test_results_submission ON test_results(submission_id)',
    'CREATE INDEX IF NOT EXISTS idx_anti_cheat_session ON anti_cheat_events(session_id)',
  ];
  for (const idx of indexes) {
    try { db.run(idx); } catch { /* index may already exist */ }
  }

  persistDb();

  // Auto-persist periodically
  persistInterval = setInterval(persistDb, 30000);

  console.log('[DB] SQLite database initialized at', dbPath);
}

export function getDb(): Database {
  return db;
}

// Helper to run a query and return all rows as plain objects
function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper to run a query and return one row
function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper to run a statement
function execute(sql: string, params: any[] = []): void {
  db.run(sql, params);
}

// --- CRUD Operations ---

export function saveSession(session: Session): void {
  execute(`
    INSERT OR REPLACE INTO sessions (id, problem_id, candidate_id, candidate_name, candidate_email, status, start_time, time_limit, max_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    session.sessionId,
    session.problemId,
    session.candidateId,
    session.candidateName || null,
    session.candidateEmail || null,
    session.status,
    session.startTime,
    session.timeLimit,
    session.maxScore,
  ]);
  persistDb();
}

export function updateSessionStatus(sessionId: string, status: string): void {
  execute('UPDATE sessions SET status = ? WHERE id = ?', [status, sessionId]);
  persistDb();
}

export function saveSubmission(
  session: Session,
  result: SubmissionResult,
  codeSnapshot: { path: string; content: string }[] | null,
): void {
  // Insert submission
  execute(`
    INSERT OR REPLACE INTO submissions (id, session_id, server_score, time_taken, warnings, anti_cheat_penalty, server_re_executed, test_mismatch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    result.submissionId,
    session.sessionId,
    result.serverScore,
    result.timeTaken,
    JSON.stringify(result.warnings),
    result.antiCheatPenalty || 0,
    result.serverReExecuted ? 1 : 0,
    result.testMismatch ? 1 : 0,
  ]);

  // Insert test results
  for (const tr of result.testResults) {
    execute(`
      INSERT INTO test_results (submission_id, test_name, status, duration, error_message, difficulty, category, test_type, hidden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      result.submissionId,
      tr.name,
      tr.status,
      tr.duration,
      tr.errorMessage || null,
      tr.difficulty,
      tr.category || 'structural',
      tr.testType,
      tr.hidden ? 1 : 0,
    ]);
  }

  // Insert difficulty breakdown
  for (const bd of result.difficultyBreakdown) {
    execute(`
      INSERT INTO difficulty_breakdown (submission_id, difficulty, total, passed, weight, weighted_earned, weighted_possible)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      result.submissionId,
      bd.difficulty,
      bd.total,
      bd.passed,
      bd.weight,
      bd.weightedEarned,
      bd.weightedPossible,
    ]);
  }

  // Insert code snapshots
  if (codeSnapshot) {
    for (const file of codeSnapshot) {
      execute(`
        INSERT INTO code_snapshots (submission_id, file_path, content)
        VALUES (?, ?, ?)
      `, [result.submissionId, file.path, file.content]);
    }
  }

  // Update session status
  updateSessionStatus(session.sessionId, 'submitted');
  persistDb();
}

export function saveLlmEvaluation(submissionId: string, evaluation: LlmEvaluation): void {
  // Delete existing if any (REPLACE not great for autoincrement PKs)
  execute('DELETE FROM llm_evaluations WHERE submission_id = ?', [submissionId]);
  execute(`
    INSERT INTO llm_evaluations (submission_id, adjusted_score, reasoning, maintainability, reliability, cyclomatic_complexity)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    submissionId,
    evaluation.adjustedScore,
    evaluation.reasoning,
    evaluation.codeQuality.maintainability,
    evaluation.codeQuality.reliability,
    evaluation.codeQuality.cyclomaticComplexity,
  ]);

  // Update adjusted_score on submission
  execute('UPDATE submissions SET adjusted_score = ? WHERE id = ?',
    [evaluation.adjustedScore, submissionId]);
  persistDb();
}

export function saveAntiCheatEvent(sessionId: string, event: AuditEvent): void {
  execute(`
    INSERT INTO anti_cheat_events (session_id, event_type, client_timestamp, server_timestamp, metadata)
    VALUES (?, ?, ?, ?, ?)
  `, [
    sessionId,
    event.type,
    event.timestamp,
    event.serverTimestamp,
    event.metadata ? JSON.stringify(event.metadata) : null,
  ]);
  // Don't persist on every event — the interval handles it
}

// Export query helpers for reporting service
export { queryAll, queryOne, execute };
