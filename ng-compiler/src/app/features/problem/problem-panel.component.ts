import { Component, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { AssessmentService } from '../../core/services/assessment.service';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-problem-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="problem-panel h-100 d-flex flex-column">
      <div class="problem-header d-flex align-items-center px-2 py-1">
        <i class="bi bi-book me-1" aria-hidden="true"></i>
        <small class="fw-bold text-uppercase">Problem</small>
      </div>
      <div class="problem-body flex-grow-1 overflow-auto p-3">
        @if (assessment.currentProblem(); as problem) {
          <div class="rendered-markdown" [innerHTML]="renderedDescription()"></div>
        } @else {
          <div class="text-center text-muted py-4">
            <i class="bi bi-journal-text" style="font-size: 2rem;" aria-hidden="true"></i>
            <p class="mt-2">Select a problem to begin</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .problem-panel { background: var(--bg-primary); color: var(--text-primary); }
    .problem-header {
      background: var(--bg-tertiary);
      font-size: 11px;
      border-bottom: 1px solid var(--border-color);
      min-height: 32px;
      flex-shrink: 0;
      color: var(--text-tertiary);
    }
    .problem-body { font-size: 14px; line-height: 1.6; }
    :host ::ng-deep .rendered-markdown {
      h1 { font-size: 1.5rem; color: var(--text-bright); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
      h2 { font-size: 1.2rem; color: var(--text-primary); margin-top: 1.5rem; }
      h3 { font-size: 1.1rem; color: var(--text-secondary); }
      code { background: var(--code-bg); padding: 2px 6px; border-radius: 3px; color: var(--code-color); font-size: 13px; }
      pre { background: var(--bg-secondary); padding: 12px; border-radius: 6px; overflow-x: auto; }
      pre code { background: none; padding: 0; }
      ul, ol { padding-left: 1.5rem; }
      li { margin-bottom: 0.3rem; }
      strong { color: var(--text-bright); }

      /* Preview mockup — looks like an app screenshot */
      .preview-mockup {
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border-color);
        margin: 16px 0;
        font-size: 13px;
        padding: 16px;
      }
      .mockup-badge {
        background: var(--badge-bg);
        color: var(--text-tertiary);
        display: inline-block;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 12px;
      }
      .mockup-controls {
        display: flex; gap: 8px; margin-bottom: 14px;
      }
      .mockup-input {
        flex: 1;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .mockup-select {
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--text-tertiary);
        font-size: 12px;
      }
      .mockup-btn {
        background: var(--badge-bg);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }
      .mockup-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 8px;
      }
      .mockup-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .mockup-card-title {
        color: var(--text-primary);
        font-weight: 500;
      }
      .mockup-priority {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--badge-bg);
        color: var(--text-tertiary);
      }
      .mockup-card-actions {
        display: flex; gap: 8px;
      }
      .mockup-act-complete, .mockup-act-delete {
        font-size: 11px;
        color: var(--text-tertiary);
        background: var(--badge-bg);
        padding: 3px 10px;
        border-radius: 4px;
      }
    }
  `],
})
export class ProblemPanelComponent {
  assessment = inject(AssessmentService);
  private sanitizer = inject(DomSanitizer);

  renderedDescription = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      const problem = this.assessment.currentProblem();
      if (problem) {
        const rawHtml = marked.parse(problem.description) as string;
        this.renderedDescription.set(this.sanitizer.bypassSecurityTrustHtml(rawHtml));
      }
    });
  }
}
