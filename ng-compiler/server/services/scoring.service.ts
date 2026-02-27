import { TestResultPayload, DifficultyBreakdown, TestDifficulty, DIFFICULTY_WEIGHTS, AuditEvent } from '../types.js';

export function calculateWeightedScore(results: TestResultPayload[]): {
  score: number;
  rawScore: number;
  difficultyBreakdown: DifficultyBreakdown[];
} {
  const difficulties: TestDifficulty[] = ['easy', 'medium', 'hard'];
  let totalWeightedEarned = 0;

  const difficultyBreakdown: DifficultyBreakdown[] = difficulties.map(difficulty => {
    const testsOfDifficulty = results.filter(r => r.difficulty === difficulty);
    const passed = testsOfDifficulty.filter(r => r.status === 'passed').length;
    const total = testsOfDifficulty.length;
    const weight = DIFFICULTY_WEIGHTS[difficulty];
    const weightedEarned = passed * weight;
    const weightedPossible = total * weight;

    totalWeightedEarned += weightedEarned;

    return { difficulty, total, passed, weight, weightedEarned, weightedPossible };
  }).filter(b => b.total > 0);

  const totalPassed = results.filter(r => r.status === 'passed').length;
  const rawScore = results.length > 0 ? totalPassed : 0;
  const score = totalWeightedEarned;

  return { score, rawScore, difficultyBreakdown };
}

// --- Anti-cheat penalty calculation ---

interface PenaltyConfig {
  threshold: number;
  penaltyPercent: number;
  maxOccurrences: number;
}

const PENALTY_CONFIG: Record<string, PenaltyConfig> = {
  devtools_open: { threshold: 1, penaltyPercent: 10, maxOccurrences: 5 },
  frequent_tab_switching: { threshold: 1, penaltyPercent: 5, maxOccurrences: 5 },
  large_paste: { threshold: 2, penaltyPercent: 5, maxOccurrences: 5 },
};

const MAX_TOTAL_PENALTY = 50; // Cap at 50%

export function calculateAntiCheatPenalty(events: AuditEvent[]): {
  penaltyPercent: number;
  breakdown: Record<string, { count: number; penalty: number }>;
} {
  const breakdown: Record<string, { count: number; penalty: number }> = {};
  let totalPenalty = 0;

  for (const [eventType, config] of Object.entries(PENALTY_CONFIG)) {
    const count = events.filter(e => e.type === eventType).length;
    if (count >= config.threshold) {
      const applicableCount = Math.min(count, config.maxOccurrences);
      const penalty = applicableCount * config.penaltyPercent;
      breakdown[eventType] = { count, penalty };
      totalPenalty += penalty;
    }
  }

  const cappedPenalty = Math.min(totalPenalty, MAX_TOTAL_PENALTY);

  return {
    penaltyPercent: cappedPenalty,
    breakdown,
  };
}
