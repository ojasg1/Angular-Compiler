// Shared types for the assessment server

export type TestDifficulty = 'easy' | 'medium' | 'hard';
export type TestType = 'positive' | 'negative' | 'edge';
export type TestCategory = 'structural' | 'behavioral' | 'dom';

export const DIFFICULTY_WEIGHTS: Record<TestDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export interface ProblemManifest {
  id: string;
  timeLimit: number;
  maxScore: number;
  expectedTestCount: number; // structural + behavioral (NOT dom)
}

export interface AuditEvent {
  type: string;
  timestamp: number;
  serverTimestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Session {
  sessionId: string;
  problemId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  nonce: string;
  hmacKey: string;
  publicKey: string;
  privateKey: string;
  encryptionKey: string;
  executionNonce: string;
  startTime: number;
  timeLimit: number;
  maxScore: number;
  expectedTestCount: number;
  status: 'active' | 'submitted' | 'expired';
  events: AuditEvent[];
  heartbeats: number[];
  testRunCount: number;
  submittedResult: SubmissionResult | null;
  codeSnapshot: { path: string; content: string }[] | null;
  llmEvaluation: LlmEvaluation | null;
  antiCheatPenalty: number;
}

export interface SessionStartRequest {
  problemId: string;
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
}

export interface SessionStartResponse {
  sessionId: string;
  nonce: string;
  hmacKey: string;
  privateKey: string;
  encryptionKey: string;
  encryptedSpecs: EncryptedSpecs;
  serverStartTime: number;
  timeLimit: number;
}

export interface EncryptedSpecs {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface HeartbeatResponse {
  serverRemainingSeconds: number;
  status: 'active' | 'expired';
  drift: number;
}

export interface EventRequest {
  type: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TestResultPayload {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  errorMessage?: string;
  difficulty: TestDifficulty;
  testType: TestType;
  category?: TestCategory;
  hidden?: boolean;
}

export interface SubmitPayload {
  testResults: {
    total: number;
    passed: number;
    failed: number;
    results: TestResultPayload[];
  };
  domTestResults: TestResultPayload[];
  signature: string;
  nonce: string;
  clientTimestamp: number;
  codeSnapshot: { path: string; content: string }[];
}

export interface DifficultyBreakdown {
  difficulty: TestDifficulty;
  total: number;
  passed: number;
  weight: number;
  weightedEarned: number;
  weightedPossible: number;
}

export interface SubmissionResult {
  serverScore: number;
  serverTimestamp: number;
  timeTaken: number;
  warnings: string[];
  submissionId: string;
  difficultyBreakdown: DifficultyBreakdown[];
  testResults: TestResultPayload[];
  serverReExecuted: boolean;
  serverTestResults: TestResultPayload[] | null;
  testMismatch: boolean;
  antiCheatPenalty: number;
}

export interface LlmEvaluation {
  adjustedScore: number;
  reasoning: string;
  codeQuality: {
    maintainability: number;
    reliability: number;
    cyclomaticComplexity: 'low' | 'moderate' | 'high';
  };
}

export interface LlmEvalRequest {
  problemDescription: string;
  codeFiles: { path: string; content: string }[];
  testSuite: {
    total: number;
    passed: number;
    failed: number;
    score: number;
    results: TestResultPayload[];
  };
  maxScore: number;
  hintsUsed: number;
}

export interface LlmHintRequest {
  testName: string;
  errorMessage: string;
  code: string;
  problemDesc: string;
  level: 2 | 3;
}

// --- Report interfaces ---

export interface CandidateReport {
  session: {
    sessionId: string;
    problemId: string;
    candidateId: string;
    candidateName?: string;
    candidateEmail?: string;
    status: string;
    startTime: number;
    timeLimit: number;
    maxScore: number;
  };
  submission: {
    submissionId: string;
    serverScore: number;
    adjustedScore: number | null;
    timeTaken: number;
    warnings: string[];
    antiCheatPenalty: number;
    serverReExecuted: boolean;
    testMismatch: boolean;
    submittedAt: string;
  } | null;
  testResults: TestResultPayload[];
  difficultyBreakdown: DifficultyBreakdown[];
  llmEvaluation: LlmEvaluation | null;
  antiCheatSummary: AntiCheatSummary;
  codeSnapshot: { path: string; content: string }[];
}

export interface LeaderboardEntry {
  rank: number;
  sessionId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  serverScore: number;
  adjustedScore: number | null;
  timeTaken: number;
  testPassRate: number;
  submittedAt: string;
}

export interface CohortAnalytics {
  totalCandidates: number;
  averageScore: number;
  medianScore: number;
  stdDeviation: number;
  percentileDistribution: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  averageTimeTaken: number;
  completionRate: number;
  difficultyAnalysis: {
    difficulty: TestDifficulty;
    passRate: number;
    avgScore: number;
  }[];
  testDiscrimination: {
    testName: string;
    passRate: number;
    difficulty: TestDifficulty;
    discriminationIndex: number;
  }[];
}

export interface TestAnalytics {
  testName: string;
  passRate: number;
  avgDuration: number;
  discriminationIndex: number;
  difficultyIndex: number;
  difficulty: TestDifficulty;
  category: TestCategory;
}

export interface TrendPoint {
  date: string;
  candidateCount: number;
  avgScore: number;
  passRate: number;
}

export interface AntiCheatSummary {
  totalEvents: number;
  byType: Record<string, number>;
  timeline: AuditEvent[];
  penaltyApplied: number;
}
