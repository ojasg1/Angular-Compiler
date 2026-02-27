import { Component, inject, output, input, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { TimerService } from '../../core/services/timer.service';
import { WebContainerService } from '../../core/services/webcontainer.service';
import { AssessmentService } from '../../core/services/assessment.service';
import { TestRunnerService } from '../../core/services/test-runner.service';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="workspace-header d-flex align-items-center justify-content-between">
      <!-- Left side: branding + title + status -->
      <div class="d-flex align-items-center gap-2 px-3">
        <span class="header-brand-text">iMocha</span>

        @if (statusInfo(); as info) {
          @if (!info.ready) {
            <div class="env-status d-flex align-items-center">
              <div class="spinner-border spinner-border-sm me-1" style="width: 12px; height: 12px;"></div>
              <small>{{ info.label }}</small>
            </div>
          } @else {
            <div class="env-status env-ready d-flex align-items-center">
              <i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>
              <small>Ready</small>
            </div>
          }
        }
      </div>

      <!-- Right side: timer + controls + actions -->
      <div class="header-actions d-flex align-items-center gap-2 px-3">
        <!-- Timer -->
        <div class="timer-pill"
             [class.timer-danger]="timer.remainingSeconds() < 120"
             [class.timer-warning]="timer.remainingSeconds() >= 120 && timer.remainingSeconds() < 300">
          <i class="bi bi-clock me-1" aria-hidden="true"></i>
          <span class="font-monospace fw-bold">{{ timer.formattedTime() }}</span>
        </div>

        <!-- Instructions -->
        <button class="header-icon-btn" (click)="showInstructions.set(true)"
                aria-label="View instructions" title="Instructions">
          <i class="bi bi-info-circle" aria-hidden="true"></i>
        </button>

        <!-- Theme toggle -->
        <button class="header-icon-btn" (click)="themeToggle.emit()"
                [attr.aria-label]="isDarkTheme() ? 'Switch to light theme' : 'Switch to dark theme'"
                title="Toggle theme">
          <i [class]="isDarkTheme() ? 'bi bi-sun-fill' : 'bi bi-moon-fill'" aria-hidden="true"></i>
        </button>

        <!-- Preview toggle -->
        <button class="header-icon-btn" (click)="previewToggle.emit()"
                [class.active]="showPreview()"
                [attr.aria-label]="showPreview() ? 'Hide preview panel' : 'Show preview panel'"
                [attr.aria-pressed]="showPreview()"
                title="Toggle Preview">
          <i [class]="showPreview() ? 'bi bi-eye-fill' : 'bi bi-eye-slash'" aria-hidden="true"></i>
        </button>

        <!-- Divider -->
        <div class="header-divider"></div>

        <!-- Action buttons -->
        <button class="action-btn action-run" (click)="runTests.emit()"
                [disabled]="testRunner.isRunning() || !webContainer.isReady() || assessment.isSubmitted()">
          @if (testRunner.isRunning()) {
            <span class="spinner-border spinner-border-sm me-1" style="width: 12px; height: 12px;"></span> Running...
          } @else {
            <i class="bi bi-play-fill me-1" aria-hidden="true"></i> Run Tests
          }
        </button>

        <button class="action-btn action-reset" (click)="resetCode.emit()"
                [disabled]="!webContainer.isReady() || assessment.isSubmitted()">
          <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i> Reset
        </button>

        <button class="action-btn action-submit" (click)="submit.emit()"
                [disabled]="!webContainer.isReady() || assessment.isSubmitted()">
          <i class="bi bi-check-lg me-1" aria-hidden="true"></i> Submit
        </button>
      </div>
    </div>

    <!-- Instructions Modal -->
    @if (showInstructions()) {
      <div class="instructions-overlay" (click)="showInstructions.set(false)" (keydown.escape)="showInstructions.set(false)">
        <div class="instructions-modal" (click)="$event.stopPropagation()">
          <div class="instructions-header">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-info-circle-fill" aria-hidden="true"></i>
              <span>Instructions</span>
            </div>
            <button class="instructions-close" (click)="showInstructions.set(false)" aria-label="Close instructions">
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div class="instructions-body">
            <p class="instructions-intro">Take a moment to prepare yourself. The Angular coding test is structured for a smooth experience.</p>

            <h4>Getting Started</h4>
            <ul>
              <li>Read the problem description in the <strong>Problem</strong> tab on the left sidebar.</li>
              <li>Starter files are pre-loaded in the editor. Switch between files using the <strong>Files</strong> tab or the file tabs above the editor.</li>
              <li>The environment runs Angular in-browser. Wait for the status indicator to show <strong>Ready</strong> before writing code.</li>
            </ul>

            <h4>Writing Angular Code</h4>
            <ul>
              <li>Implement your solution using <strong>Angular components, services, signals, and templates</strong> as described in the problem.</li>
              <li>Use proper TypeScript indentation. The editor recognizes 1 tab = 2 spaces.</li>
              <li>Press <strong>Ctrl + Space</strong> for auto-suggestions. Since it is a web-based platform, auto-suggestions are limited.</li>
              <li><strong>Note:</strong> Clicking <strong>Reset</strong> will restore all files to their original starter code. Any changes you have made will be lost.</li>
            </ul>

            <h4>Running Tests</h4>
            <ul>
              <li>Click <strong>Run Tests</strong> to compile your Angular code and execute the test suite.</li>
              <li>Test results appear in the <strong>Tests</strong> tab at the bottom panel.</li>
              <li>Check the <strong>Console</strong> tab for runtime logs and the <strong>Problems</strong> tab for compilation errors.</li>
            </ul>

            <h4>Preview</h4>
            <ul>
              <li>Toggle the <strong>Preview</strong> panel using the eye icon in the header to see your Angular application running live.</li>
              <li>The preview updates automatically as you edit and save your code.</li>
            </ul>

            <h4>Submitting</h4>
            <ul>
              <li>Click <strong>Submit</strong> when you are ready. Your latest saved code will be evaluated.</li>
              <li>You can only submit once. Make sure to run tests and verify your solution before submitting.</li>
              <li>The timer in the header shows your remaining time. The assessment auto-submits when time runs out.</li>
            </ul>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .workspace-header {
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
      min-height: 44px;
    }
    .header-icon {
      height: 20px;
      flex-shrink: 0;
    }
    .header-brand-text {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-bright);
      flex-shrink: 0;
    }
    .timer-pill {
      font-size: 13px;
      color: #4ec9b0;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-radius: 16px;
      border: 1px solid var(--border-color);
    }
    .timer-pill.timer-danger { color: #f48771; border-color: #5c1a1a; }
    .timer-pill.timer-warning { color: #cca700; border-color: #5c4a00; }
    .env-status {
      font-size: 11px;
      color: #cca700;
      padding: 2px 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
    }
    .env-ready { color: #89d185; }
    .header-icon-btn {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      width: 30px;
      height: 30px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
      font-size: 14px;
    }
    .header-icon-btn:hover { color: var(--text-bright); background: var(--bg-hover); }
    .header-icon-btn.active { color: #667eea; border-color: #667eea; }
    .header-divider {
      width: 1px;
      height: 20px;
      background: var(--border-color);
      opacity: 0.5;
    }
    .action-btn {
      border: none;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
    }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-run {
      background: #667eea;
      color: #fff;
    }
    .action-run:hover:not(:disabled) { background: #5a6fd6; }
    .action-reset {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }
    .action-reset:hover:not(:disabled) { background: var(--bg-hover); }
    .action-submit {
      background: #43a047;
      color: #fff;
    }
    .action-submit:hover:not(:disabled) { background: #388e3c; }

    /* Instructions Modal */
    .instructions-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: instrFadeIn 0.2s ease;
    }
    .instructions-modal {
      max-width: 600px;
      width: 92%;
      max-height: 80vh;
      background: var(--bg-primary, #1e1e2e);
      border: 1px solid var(--border-color, #333);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      animation: instrSlideUp 0.3s ease;
    }
    .instructions-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      flex-shrink: 0;
    }
    .instructions-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.15s;
    }
    .instructions-close:hover { background: rgba(255,255,255,0.3); }
    .instructions-body {
      padding: 20px 24px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.7;
      color: var(--text-secondary, #ccc);
    }
    .instructions-intro {
      font-size: 14px;
      color: var(--text-bright, #fff);
      margin-bottom: 16px;
      padding: 10px 14px;
      background: var(--bg-secondary, #252535);
      border-radius: 8px;
      border-left: 3px solid #667eea;
    }
    .instructions-body h4 {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-bright, #fff);
      margin: 16px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .instructions-body ul {
      padding-left: 18px;
      margin: 0 0 12px;
    }
    .instructions-body li {
      margin-bottom: 6px;
    }
    .instructions-body strong {
      color: var(--text-bright, #fff);
    }
    @keyframes instrFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes instrSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class WorkspaceHeaderComponent {
  timer = inject(TimerService);
  webContainer = inject(WebContainerService);
  assessment = inject(AssessmentService);
  testRunner = inject(TestRunnerService);

  showInstructions = signal(false);

  isDarkTheme = input(true);
  showPreview = input(true);
  themeToggle = output<void>();
  previewToggle = output<void>();
  runTests = output<void>();
  resetCode = output<void>();
  submit = output<void>();

  statusInfo = computed(() => {
    const stage = this.webContainer.stage();
    switch (stage) {
      case 'installing': return { label: 'Installing deps...', ready: false };
      case 'starting': return { label: 'Starting server...', ready: false };
      case 'ready': return { label: 'Ready', ready: true };
      case 'error': return { label: 'Error', ready: false };
      default: return null;
    }
  });
}
