import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { TestRunnerService } from '../../core/services/test-runner.service';
import { HintService } from '../../core/services/hint.service';
import { AssessmentService } from '../../core/services/assessment.service';
import { FileSystemService } from '../editor/editor.service';
import { DIFFICULTY_WEIGHTS, TestDifficulty } from '../../core/models/problem.model';

@Component({
  selector: 'app-test-results-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="test-results-panel h-100 d-flex flex-column">
      <div class="results-header d-flex align-items-center px-2 py-1">
        <i class="bi bi-check2-square me-1"></i>
        <small class="fw-bold text-uppercase">Test Results</small>
        @if (testRunner.isRunning()) {
          <span class="spinner-border spinner-border-sm ms-2" style="width: 12px; height: 12px;"></span>
        }
      </div>

      <div class="results-body flex-grow-1 overflow-auto p-2">
        @if (testRunner.testSuite(); as suite) {
          <!-- Test summary -->
          <div class="test-summary mb-3 p-3 rounded text-center"
               [class.score-perfect]="suite.failed === 0 && suite.total > 0"
               [class.score-partial]="suite.failed > 0 && suite.passed > 0"
               [class.score-zero]="suite.passed === 0 && suite.total > 0">
            <h2 class="mb-0 text-white">{{ suite.passed }}/{{ suite.total }}</h2>
            <small class="text-white-50">tests passed</small>
          </div>

          <!-- Progress bar -->
          <div class="progress mb-3" style="height: 8px;">
            <div class="progress-bar bg-success"
                 [style.width.%]="suite.total > 0 ? (suite.passed / suite.total) * 100 : 0"></div>
            <div class="progress-bar bg-secondary"
                 [style.width.%]="suite.total > 0 ? (suite.failed / suite.total) * 100 : 0"></div>
          </div>

          <!-- Difficulty breakdown -->
          @if (suite.difficultyBreakdown && suite.difficultyBreakdown.length > 0) {
            <div class="difficulty-breakdown mb-3 rounded">
              <div class="breakdown-header px-3 py-2">
                <small class="fw-bold text-uppercase">Difficulty Breakdown</small>
              </div>
              @for (b of suite.difficultyBreakdown; track b.difficulty) {
                <div class="breakdown-row px-3 py-2">
                  <div class="d-flex align-items-center justify-content-between mb-1">
                    <div class="d-flex align-items-center gap-2">
                      <span class="diff-dot"
                            [class.dot-easy]="b.difficulty === 'easy'"
                            [class.dot-medium]="b.difficulty === 'medium'"
                            [class.dot-hard]="b.difficulty === 'hard'"></span>
                      <span class="diff-label text-capitalize">{{ b.difficulty }}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                      <span class="diff-count"
                            [class.score-all-passed]="b.passed === b.total"
                            [class.score-partial]="b.passed > 0 && b.passed < b.total"
                            [class.score-none-passed]="b.passed === 0 && b.total > 0">
                        {{ b.passed }}/{{ b.total }}
                      </span>
                    </div>
                  </div>
                  <div class="diff-bar">
                    <div class="diff-bar-fill"
                         [class.bar-easy]="b.difficulty === 'easy'"
                         [class.bar-medium]="b.difficulty === 'medium'"
                         [class.bar-hard]="b.difficulty === 'hard'"
                         [style.width.%]="b.total > 0 ? (b.passed / b.total) * 100 : 0"></div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Test list -->
          @for (result of sortedResults(); track $index) {
            <div class="test-item p-2 mb-1 rounded"
                 [class.test-passed]="result.status === 'passed'"
                 [class.test-failed]="result.status === 'failed'"
                 [class.test-hidden]="result.hidden">
              <div class="test-case-header d-flex align-items-center gap-2 mb-1">
                <i [class]="result.status === 'passed' ? 'bi bi-check-circle-fill text-success' : 'bi bi-x-circle-fill test-failed-icon'"></i>
                <span class="test-case-label">Test Case {{ result.displayIndex }}:</span>
                <span class="difficulty-pill ms-auto"
                      [class.pill-easy]="result.difficulty === 'easy'"
                      [class.pill-medium]="result.difficulty === 'medium'"
                      [class.pill-hard]="result.difficulty === 'hard'">
                  {{ result.difficulty }}
                </span>
              </div>
              <div class="test-case-body ps-4">
                @if (result.hidden) {
                  <span class="hidden-test-label"><i class="bi bi-lock-fill me-1"></i>Hidden Test Case #{{ result.hiddenNumber }}</span>
                } @else {
                  <span class="test-name-text">{{ result.name }}</span>
                }
                @if (result.errorMessage && !result.hidden) {
                  <small class="test-error-msg d-block mt-1">
                    <code>{{ result.errorMessage }}</code>
                  </small>
                }
                @if (!result.hidden) {
                  <div class="d-flex align-items-center gap-2 mt-1">
                    <small class="text-muted">{{ result.duration }}ms</small>
                  </div>
                }

                <!-- Hint UI for failed visible tests -->
                @if (result.status === 'failed' && !result.hidden) {
                  <div class="hint-area mt-2">
                    @if (getHintState(result.name); as hintState) {
                      @for (hint of hintState.hints; track $index) {
                        <div class="hint-bubble mb-1">
                          <i class="bi bi-lightbulb-fill text-warning me-1"></i>
                          <small>{{ hint }}</small>
                        </div>
                      }
                      @if (hintState.isLoading) {
                        <div class="hint-loading">
                          <span class="spinner-border spinner-border-sm me-1" style="width: 10px; height: 10px;"></span>
                          <small class="text-muted">Generating hint...</small>
                        </div>
                      }
                      @if (hintState.currentLevel < 3 && !hintState.isLoading) {
                        <button class="hint-btn" (click)="requestHint(result.name, result.errorMessage || '')">
                          <i class="bi bi-lightbulb me-1"></i>
                          {{ hintState.currentLevel === 0 ? 'Get Hint' : 'Need more help?' }}
                        </button>
                      }
                    } @else {
                      <button class="hint-btn" (click)="requestHint(result.name, result.errorMessage || '')">
                        <i class="bi bi-lightbulb me-1"></i>
                        Get Hint
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        } @else if (!testRunner.isRunning()) {
          <div class="text-center py-4 empty-state">
            <i class="bi bi-play-circle" style="font-size: 2rem;"></i>
            <p class="mt-2 mb-0">Click "Run Tests" to execute the test suite</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .test-results-panel { background: var(--bg-primary); color: var(--text-secondary); }
    .results-header {
      background: var(--bg-tertiary);
      font-size: 11px;
      border-bottom: 1px solid var(--border-color);
      min-height: 32px;
      flex-shrink: 0;
      color: var(--text-tertiary);
    }
    .results-body { font-size: 13px; }
    .score-display { background: var(--badge-bg); }
    .score-perfect { background: #1b5e20 !important; }
    .score-partial { background: #e65100 !important; }
    .score-zero { background: #455a64 !important; }
    .test-item { background: var(--bg-secondary); font-size: 13px; }
    .test-item.test-passed { border-left: 3px solid #28a745; }
    .test-item.test-failed { border-left: 3px solid #78909c; }
    .test-item.test-hidden { opacity: 0.75; }
    .test-item.test-hidden.test-passed { border-left: 3px solid #28a74588; }
    .test-item.test-hidden.test-failed { border-left: 3px solid #78909c88; }
    .test-name { color: var(--text-primary); }
    code { font-size: 11px; }

    /* Difficulty breakdown */
    .difficulty-breakdown {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      overflow: hidden;
    }
    .breakdown-header {
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .breakdown-row {
      border-bottom: 1px solid var(--border-subtle);
    }
    .breakdown-row:last-child { border-bottom: none; }
    .diff-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-easy { background: #4caf50; }
    .dot-medium { background: #ff9800; }
    .dot-hard { background: #f44336; }
    .diff-label { font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .diff-weight {
      font-size: 10px;
      color: var(--text-muted);
      background: var(--badge-bg);
      padding: 0 6px;
      border-radius: 3px;
    }
    .diff-count { font-size: 12px; font-weight: 600; }
    .diff-pts { font-size: 10px; color: var(--text-muted); }
    .diff-bar {
      height: 4px;
      background: var(--badge-bg);
      border-radius: 2px;
      overflow: hidden;
    }
    .diff-bar-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.4s ease;
    }
    .bar-easy { background: #4caf50; }
    .bar-medium { background: #ff9800; }
    .bar-hard { background: #f44336; }

    /* Test case header & body */
    .test-case-header { font-size: 12px; }
    .test-case-label {
      font-weight: 700;
      color: var(--text-primary);
      font-size: 12px;
    }
    .test-case-body { font-size: 13px; }
    .test-name-text { color: var(--text-primary); }

    /* Difficulty pill */
    .difficulty-pill {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 10px;
      text-transform: capitalize;
    }
    .pill-easy { background: #e8f5e9; color: #2e7d32; }
    .pill-medium { background: #fff3e0; color: #e65100; }
    .pill-hard { background: #fce4ec; color: #c62828; }

    /* Category icon */
    .category-icon { font-size: 11px; color: var(--text-muted); }

    /* Hint UI */
    .hint-area { margin-top: 4px; }
    .hint-bubble {
      background: #2a2a1e;
      border: 1px solid #554d00;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      color: #f0e8b0;
    }
    .hint-btn {
      background: transparent;
      border: 1px dashed var(--text-muted);
      color: var(--text-tertiary);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .hint-btn:hover { border-color: #ffc107; color: #ffc107; }
    .hint-loading { font-size: 11px; }

    /* Scenario colors */
    .score-all-passed { color: #2e7d32; }
    .score-partial { color: #e65100; }
    .score-none-passed { color: #546e7a; }
    .test-failed-icon { color: #78909c; }
    .test-error-msg { color: #90a4ae; }
    .hidden-test-label { color: var(--text-tertiary); font-style: italic; }
    .empty-state { color: var(--text-tertiary); }
  `],
})
export class TestResultsPanelComponent {
  testRunner = inject(TestRunnerService);
  hintService = inject(HintService);
  private assessment = inject(AssessmentService);
  private fileSystem = inject(FileSystemService);

  /** Max score from the current problem */
  maxScore = computed(() => this.assessment.currentProblem()?.maxScore ?? 0);

  /** Sorted results: visible first, then hidden; sequential + hidden counter */
  sortedResults = computed(() => {
    const suite = this.testRunner.testSuite();
    if (!suite) return [];
    const sorted = [...suite.results].sort((a, b) => {
      if (a.hidden === b.hidden) return 0;
      return a.hidden ? 1 : -1;
    });
    let hiddenIdx = 0;
    return sorted.map((r, i) => ({
      ...r,
      displayIndex: i + 1,
      hiddenNumber: r.hidden ? ++hiddenIdx : 0,
    }));
  });

  /** Direct mark value for a test: Easy=1, Medium=2, Hard=3 */
  testPoints(difficulty: TestDifficulty): number {
    return DIFFICULTY_WEIGHTS[difficulty];
  }

  getHintState(testName: string) {
    return this.hintService.getHintState(testName);
  }

  requestHint(testName: string, errorMessage: string): void {
    const problem = this.assessment.currentProblem();
    const code = this.fileSystem.files().map(f => f.content).join('\n');
    this.hintService.requestHint(
      testName,
      errorMessage,
      code,
      problem?.description || ''
    );
  }
}
