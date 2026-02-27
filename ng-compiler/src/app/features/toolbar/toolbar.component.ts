import { Component, inject, output } from '@angular/core';
import { AssessmentService } from '../../core/services/assessment.service';
import { TestRunnerService } from '../../core/services/test-runner.service';
import { WebContainerService } from '../../core/services/webcontainer.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="toolbar d-flex align-items-center justify-content-between px-3 py-2">
      <div class="d-flex align-items-center gap-2">
        @if (assessment.currentProblem(); as problem) {
          <span class="badge bg-primary">{{ problem.title }}</span>
        }

        @if (webContainer.isReady()) {
          <span class="badge bg-success">
            <i class="bi bi-circle-fill me-1" style="font-size: 6px;"></i> Connected
          </span>
        }
      </div>

      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-info btn-sm" (click)="runTests.emit()"
                [disabled]="testRunner.isRunning() || !webContainer.isReady() || assessment.isSubmitted()">
          @if (testRunner.isRunning()) {
            <span class="spinner-border spinner-border-sm me-1"></span> Running...
          } @else {
            <i class="bi bi-play-fill me-1"></i> Run Tests
          }
        </button>

        <button class="btn btn-outline-secondary btn-sm" (click)="resetCode.emit()"
                [disabled]="!webContainer.isReady() || assessment.isSubmitted()">
          <i class="bi bi-arrow-counterclockwise me-1"></i> Reset
        </button>

        <button class="btn btn-success btn-sm" (click)="submit.emit()"
                [disabled]="!webContainer.isReady() || assessment.isSubmitted()">
          <i class="bi bi-check-lg me-1"></i> Submit
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      background: #2d2d2d;
      border-top: 1px solid #333;
      min-height: 44px;
    }
    .btn { font-size: 13px; }
  `],
})
export class ToolbarComponent {
  assessment = inject(AssessmentService);
  testRunner = inject(TestRunnerService);
  webContainer = inject(WebContainerService);

  runTests = output<void>();
  resetCode = output<void>();
  submit = output<void>();
}
