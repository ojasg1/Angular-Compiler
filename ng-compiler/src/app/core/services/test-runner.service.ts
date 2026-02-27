import { Injectable, signal, inject } from '@angular/core';
import { WebContainerService } from './webcontainer.service';
import { DomTestBridgeService } from './dom-test-bridge.service';
import {
  TestSuite, TestResult, TestDifficulty, TestType, TestCategory,
  DIFFICULTY_WEIGHTS, DifficultyBreakdown, DomTestSpec, DomAssert, DomTestStep, Problem
} from '../models/problem.model';
@Injectable({ providedIn: 'root' })
export class TestRunnerService {
  private webContainer = inject(WebContainerService);
  private domBridge = inject(DomTestBridgeService);

  readonly isRunning = signal(false);
  readonly testSuite = signal<TestSuite | null>(null);
  readonly testOutput = signal('');

  async runTests(maxScore: number, problem?: Problem): Promise<TestSuite> {
    this.isRunning.set(true);
    this.testOutput.set('');

    try {
      // Phase 1: Run structural + behavioral tests via WebContainer
      const { output } = await this.webContainer.spawn('node', ['run-tests.js']);
      this.testOutput.set(output);

      // Parse test results from output
      const startMarker = '__TEST_RESULTS_START__';
      const endMarker = '__TEST_RESULTS_END__';
      const startIdx = output.indexOf(startMarker);
      const endIdx = output.indexOf(endMarker);

      if (startIdx === -1 || endIdx === -1) {
        const errorSuite: TestSuite = {
          total: 0,
          passed: 0,
          failed: 0,
          score: 0,
          results: [],
        };
        this.testSuite.set(errorSuite);
        return errorSuite;
      }

      const jsonStr = output.substring(startIdx + startMarker.length, endIdx).trim();
      const raw = JSON.parse(jsonStr);

      // Extract HMAC signature if present
      const hmacSignature = raw.signature || '';
      const hmacNonce = raw.nonce || '';

      const validDifficulties: TestDifficulty[] = ['easy', 'medium', 'hard'];
      const validTypes: TestType[] = ['positive', 'negative', 'edge'];
      const validCategories: TestCategory[] = ['structural', 'behavioral', 'dom'];

      const results: TestResult[] = (raw.results || []).map((r: any) => ({
        name: r.name,
        status: r.status,
        duration: r.duration,
        errorMessage: r.errorMessage,
        difficulty: validDifficulties.includes(r.difficulty) ? r.difficulty : 'medium',
        testType: validTypes.includes(r.testType) ? r.testType : 'positive',
        timedOut: false,
        category: validCategories.includes(r.category) ? r.category : 'structural',
        hidden: r.hidden || false,
      }));

      // Phase 2: DOM tests via iframe bridge
      if (problem?.domTests && problem.domTests.length > 0 && this.domBridge.isAvailable()) {
        // Wait 1s for Vite HMR to reflect latest code changes
        await new Promise(resolve => setTimeout(resolve, 1000));

        for (const domTest of problem.domTests) {
          const domResult = await this.runDomTest(domTest);
          results.push(domResult);
        }
      }

      // Keep full (unmasked) results for LLM evaluation
      const fullResults = results.map(r => ({ ...r }));

      // Mask hidden test details for UI
      const maskedResults = results.map((r, i) => {
        if (!r.hidden) return r;
        return {
          ...r,
          name: `Hidden test case`,
          errorMessage: undefined,
        };
      });

      // Calculate weighted scoring
      const { score, rawScore, difficultyBreakdown } = this.calculateWeightedScore(maskedResults, maxScore);

      const suite: TestSuite = {
        total: maskedResults.length,
        passed: maskedResults.filter(r => r.status === 'passed').length,
        failed: maskedResults.filter(r => r.status === 'failed').length,
        score,
        rawScore,
        difficultyBreakdown,
        results: maskedResults,
        fullResults,
        signature: hmacSignature,
        nonce: hmacNonce,
      };

      this.testSuite.set(suite);
      return suite;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorSuite: TestSuite = {
        total: 0,
        passed: 0,
        failed: 0,
        score: 0,
        results: [{
          name: 'Test Runner',
          status: 'failed',
          duration: 0,
          errorMessage,
          difficulty: 'easy',
          testType: 'positive',
          category: 'structural',
        }],
      };
      this.testSuite.set(errorSuite);
      return errorSuite;
    } finally {
      this.isRunning.set(false);
    }
  }

  private async runDomTest(spec: DomTestSpec): Promise<TestResult> {
    const start = Date.now();

    try {
      for (const step of spec.steps) {
        const result = await this.executeDomStep(step);

        if (step.assert) {
          this.checkDomAssert(step, result, step.assert);
        }
      }

      return {
        name: spec.name,
        status: 'passed',
        duration: Date.now() - start,
        difficulty: spec.difficulty,
        testType: spec.testType,
        category: 'dom',
        hidden: spec.hidden || false,
      };
    } catch (err) {
      return {
        name: spec.name,
        status: 'failed',
        duration: Date.now() - start,
        errorMessage: err instanceof Error ? err.message : String(err),
        difficulty: spec.difficulty,
        testType: spec.testType,
        category: 'dom',
        hidden: spec.hidden || false,
      };
    }
  }

  private async executeDomStep(step: DomTestStep): Promise<any> {
    switch (step.command) {
      case 'querySelector':
        return this.domBridge.querySelector(step.selector!);
      case 'querySelectorAll':
        return this.domBridge.querySelectorAll(step.selector!);
      case 'click':
        return this.domBridge.click(step.selector!, step.delay);
      case 'type':
        return this.domBridge.type(step.selector!, step.value!, step.delay);
      case 'wait':
        return this.domBridge.wait(step.delay || 500);
      default:
        throw new Error(`Unknown DOM command: ${step.command}`);
    }
  }

  private checkDomAssert(step: DomTestStep, result: any, assert: DomAssert): void {
    if (assert.exists !== undefined) {
      if (assert.exists && !result.found) {
        throw new Error(`Expected element "${step.selector}" to exist but it was not found`);
      }
      if (!assert.exists && result.found) {
        throw new Error(`Expected element "${step.selector}" not to exist but it was found`);
      }
    }

    if (assert.textContains !== undefined && result.found) {
      const text = result.textContent || '';
      if (!text.includes(assert.textContains)) {
        throw new Error(`Expected "${step.selector}" to contain text "${assert.textContains}" but got "${text.substring(0, 100)}"`);
      }
    }

    if (assert.countGte !== undefined) {
      const count = result.count || 0;
      if (count < assert.countGte) {
        throw new Error(`Expected at least ${assert.countGte} elements matching "${step.selector}" but found ${count}`);
      }
    }

    if (assert.countLte !== undefined) {
      const count = result.count || 0;
      if (count > assert.countLte) {
        throw new Error(`Expected at most ${assert.countLte} elements matching "${step.selector}" but found ${count}`);
      }
    }

    if (assert.countEquals !== undefined) {
      const count = result.count || 0;
      if (count !== assert.countEquals) {
        throw new Error(`Expected exactly ${assert.countEquals} elements matching "${step.selector}" but found ${count}`);
      }
    }

    if (assert.hasClass !== undefined && result.found) {
      const className = result.className || '';
      if (!className.includes(assert.hasClass)) {
        throw new Error(`Expected "${step.selector}" to have class "${assert.hasClass}"`);
      }
    }

    if (assert.valueEquals !== undefined && result.found) {
      const value = result.value || '';
      if (value !== assert.valueEquals) {
        throw new Error(`Expected "${step.selector}" value to be "${assert.valueEquals}" but got "${value}"`);
      }
    }
  }

  private calculateWeightedScore(results: TestResult[], _maxScore: number): {
    score: number;
    rawScore: number;
    difficultyBreakdown: DifficultyBreakdown[];
  } {
    const difficulties: TestDifficulty[] = ['easy', 'medium', 'hard'];
    let totalWeightedEarned = 0;
    let totalWeightedPossible = 0;

    const difficultyBreakdown: DifficultyBreakdown[] = difficulties.map(difficulty => {
      const testsOfDifficulty = results.filter(r => r.difficulty === difficulty);
      const passed = testsOfDifficulty.filter(r => r.status === 'passed').length;
      const total = testsOfDifficulty.length;
      const weight = DIFFICULTY_WEIGHTS[difficulty];
      const weightedEarned = passed * weight;
      const weightedPossible = total * weight;

      totalWeightedEarned += weightedEarned;
      totalWeightedPossible += weightedPossible;

      return { difficulty, total, passed, weight, weightedEarned, weightedPossible };
    }).filter(b => b.total > 0);

    // Direct marks: Easy=1, Medium=2, Hard=3 per passed test
    const totalPassed = results.filter(r => r.status === 'passed').length;
    const rawScore = results.length > 0 ? totalPassed : 0;
    const score = totalWeightedEarned;

    return { score, rawScore, difficultyBreakdown };
  }

  reset(): void {
    this.testSuite.set(null);
    this.testOutput.set('');
  }
}
