import { Injectable, signal, inject } from '@angular/core';
import { LlmEvaluation, TestSuite } from '../models/problem.model';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class LlmEvaluatorService {
  private sessionService = inject(SessionService);
  readonly isEvaluating = signal(false);

  // Always available — API key is on the server
  get hasApiKey(): boolean {
    return true;
  }

  async evaluate(
    problemDescription: string,
    codeFiles: { path: string; content: string }[],
    testSuite: TestSuite,
    maxScore: number,
    hintsUsed: number = 0
  ): Promise<LlmEvaluation | null> {
    this.isEvaluating.set(true);

    try {
      const result = await this.sessionService.requestLlmEval({
        problemDescription,
        codeFiles,
        testSuite: {
          total: testSuite.total,
          passed: testSuite.passed,
          failed: testSuite.failed,
          score: testSuite.score,
          results: testSuite.results, // masked results only
        },
        maxScore,
        hintsUsed,
      });

      if (!result) return null;

      const parsed = result as LlmEvaluation;
      return {
        adjustedScore: parsed.adjustedScore,
        reasoning: parsed.reasoning || 'No reasoning provided.',
        codeQuality: parsed.codeQuality,
      };
    } catch (err) {
      console.error('LLM evaluation failed:', err);
      return null;
    } finally {
      this.isEvaluating.set(false);
    }
  }
}
