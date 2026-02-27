import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { BootStage } from '../../core/services/webcontainer.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="loading-overlay">
        <div class="loading-card text-center">
          <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <h4>{{ stageLabel() }}</h4>
          <p class="text-muted mb-3">{{ stageDescription() }}</p>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated"
                 [style.width.%]="stageProgress()"></div>
          </div>
          <div class="mt-3">
            <small class="text-muted">
              @for (step of steps; track step.stage) {
                <span [class.text-success]="isStepComplete(step.stage)"
                      [class.fw-bold]="step.stage === stage()">
                  <i [class]="isStepComplete(step.stage) ? 'bi bi-check-circle-fill' : 'bi bi-circle'"></i>
                  {{ step.label }}
                </span>
                @if (!$last) { <span class="mx-2">→</span> }
              }
            </small>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .loading-card {
      background: white;
      border-radius: 12px;
      padding: 2rem 3rem;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
  `],
})
export class LoadingOverlayComponent {
  stage = input.required<BootStage>();

  steps = [
    { stage: 'booting' as BootStage, label: 'Booting', progress: 20 },
    { stage: 'installing' as BootStage, label: 'Installing', progress: 60 },
    { stage: 'starting' as BootStage, label: 'Starting', progress: 85 },
    { stage: 'ready' as BootStage, label: 'Ready', progress: 100 },
  ];

  visible = computed(() => {
    const s = this.stage();
    return ['booting', 'installing', 'starting'].includes(s);
  });

  stageLabel = computed(() => {
    switch (this.stage()) {
      case 'booting': return 'Booting Environment...';
      case 'installing': return 'Installing Dependencies...';
      case 'starting': return 'Starting Dev Server...';
      default: return 'Loading...';
    }
  });

  stageDescription = computed(() => {
    switch (this.stage()) {
      case 'booting': return 'Initializing the in-browser Node.js runtime';
      case 'installing': return 'Running npm install — this may take 15-30 seconds';
      case 'starting': return 'Compiling Angular project with ng serve';
      default: return 'Please wait...';
    }
  });

  stageProgress = computed(() => {
    const step = this.steps.find(s => s.stage === this.stage());
    return step?.progress ?? 10;
  });

  isStepComplete(stepStage: BootStage): boolean {
    const order: BootStage[] = ['booting', 'installing', 'starting', 'ready'];
    const currentIdx = order.indexOf(this.stage());
    const stepIdx = order.indexOf(stepStage);
    return stepIdx < currentIdx;
  }
}
