import { VirtualFile } from './virtual-file.model';

export type TestDifficulty = 'easy' | 'medium' | 'hard';
export type TestType = 'positive' | 'negative' | 'edge';
export type TestCategory = 'structural' | 'behavioral' | 'dom';

export const DIFFICULTY_WEIGHTS: Record<TestDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export interface DifficultyBreakdown {
  difficulty: TestDifficulty;
  total: number;
  passed: number;
  weight: number;
  weightedEarned: number;
  weightedPossible: number;
}

export interface DomAssert {
  exists?: boolean;
  textContains?: string;
  countGte?: number;
  countLte?: number;
  countEquals?: number;
  hasClass?: string;
  valueEquals?: string;
}

export interface DomTestStep {
  command: 'querySelector' | 'querySelectorAll' | 'click' | 'type' | 'wait';
  selector?: string;
  value?: string;
  delay?: number;
  assert?: DomAssert;
}

export interface DomTestSpec {
  name: string;
  difficulty: TestDifficulty;
  testType: TestType;
  hidden?: boolean;
  steps: DomTestStep[];
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  starterFiles: VirtualFile[];
  testFiles: VirtualFile[];
  maxScore: number;
  timeLimit: number;
  domTests?: DomTestSpec[];
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  errorMessage?: string;
  difficulty: TestDifficulty;
  testType: TestType;
  timedOut?: boolean;
  category?: TestCategory;
  hidden?: boolean;
}

export interface CodeQualityRatings {
  maintainability: number;
  reliability: number;
  cyclomaticComplexity: 'low' | 'moderate' | 'high';
}

export interface LlmEvaluation {
  adjustedScore: number;
  reasoning: string;
  codeQuality: CodeQualityRatings;
}

export interface TestSuite {
  total: number;
  passed: number;
  failed: number;
  score: number;
  rawScore?: number;
  difficultyBreakdown?: DifficultyBreakdown[];
  results: TestResult[];
  fullResults?: TestResult[];
  llmEvaluation?: LlmEvaluation;
  finalScore?: number;
  signature?: string;
  nonce?: string;
  serverVerified?: boolean;
}
