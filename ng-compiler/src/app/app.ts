import { Component, inject, signal, computed, effect, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { AssessmentService } from './core/services/assessment.service';
import { WebContainerService } from './core/services/webcontainer.service';
import { CompilationService } from './core/services/compilation.service';
import { LoadingOverlayComponent } from './shared/components/loading-overlay.component';
import { CodeEditorComponent } from './features/editor/code-editor.component';
import { FileTreeComponent } from './features/file-explorer/file-tree.component';
import { PreviewPanelComponent } from './features/preview/preview-panel.component';
import { TestResultsPanelComponent } from './features/test-results/test-results-panel.component';
import { ProblemPanelComponent } from './features/problem/problem-panel.component';
import { WorkspaceHeaderComponent } from './features/workspace/workspace-header.component';
import { TabBarComponent } from './shared/components/tab-bar.component';
import { AppConsoleComponent } from './features/preview/app-console.component';
import { AppConsoleService } from './core/services/app-console.service';
import { FileSystemService } from './features/editor/editor.service';
import { PROBLEMS } from './core/constants/problems';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingOverlayComponent,
    CodeEditorComponent,
    FileTreeComponent,
    PreviewPanelComponent,
    TestResultsPanelComponent,
    ProblemPanelComponent,
    WorkspaceHeaderComponent,
    TabBarComponent,
    AppConsoleComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  assessment = inject(AssessmentService);
  webContainer = inject(WebContainerService);
  compilation = inject(CompilationService);
  appConsole = inject(AppConsoleService);
  fileSystem = inject(FileSystemService);

  Math = Math;

  constructor() {
    // Sync theme class on body element
    effect(() => {
      const dark = this.isDarkTheme();
      document.body.classList.toggle('theme-dark', dark);
      document.body.classList.toggle('theme-light', !dark);
    });
  }

  isDarkTheme = signal(true);
  isLoading = signal(false);
  errorMessage = signal('');

  // Candidate auth
  candidateName = signal('');
  candidateEmail = signal('');
  privacyConsent = signal(false);
  canAuthenticate = computed(() => {
    const name = this.candidateName().trim();
    const email = this.candidateEmail().trim();
    const consent = this.privacyConsent();
    return name.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && consent;
  });

  // Confirmation dialog state
  confirmDialog = signal<{ message: string; action: () => Promise<unknown> } | null>(null);

  // Layout state
  sidebarTab = signal<'problem' | 'files'>('problem');
  bottomTab = signal<'console' | 'tests' | 'errors'>('console');
  sidebarWidth = signal(300);
  bottomPanelHeight = signal(250);
  showPreview = signal(true);
  previewWidth = signal(400);

  // Drag state
  dragging: 'sidebar' | 'bottom' | 'preview' | null = null;
  private dragStartPos = 0;
  private dragStartSize = 0;

  authenticate(): void {
    if (!this.canAuthenticate()) return;
    this.startAssessment(PROBLEMS[0].id);
  }

  async startAssessment(problemId: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      await this.assessment.initialize(problemId);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to initialize assessment');
      console.error('Assessment init error:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRunTests(): Promise<void> {
    this.bottomTab.set('tests');
    await this.assessment.runTests();
  }

  onSubmit(): void {
    this.confirmDialog.set({
      message: 'Are you sure you want to submit? This action cannot be undone.',
      action: async () => await this.assessment.submit(),
    });
  }

  onReset(): void {
    this.confirmDialog.set({
      message: 'Reset all code to the original starter files? Your changes will be lost.',
      action: async () => await this.assessment.reset(),
    });
  }

  async confirmAction(): Promise<void> {
    const dialog = this.confirmDialog();
    if (dialog) {
      this.confirmDialog.set(null);
      await dialog.action();
    }
  }

  cancelConfirm(): void {
    this.confirmDialog.set(null);
  }

  togglePreview(): void {
    this.showPreview.update((v) => !v);
  }

  toggleTheme(): void {
    this.isDarkTheme.update((v) => !v);
  }

  toggleBottomPanel(): void {
    if (this.bottomPanelHeight() > 50) {
      this.bottomPanelHeight.set(36);
    } else {
      this.bottomPanelHeight.set(250);
    }
  }

  backToProblems(): void {
    this.assessment.isSubmitted.set(false);
    this.assessment.currentProblem.set(null);
    this.webContainer.teardown();
  }

  // --- Resize handlers ---
  startSidebarDrag(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = 'sidebar';
    this.dragStartPos = event.clientX;
    this.dragStartSize = this.sidebarWidth();
  }

  startBottomDrag(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = 'bottom';
    this.dragStartPos = event.clientY;
    this.dragStartSize = this.bottomPanelHeight();
  }

  startPreviewDrag(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = 'preview';
    this.dragStartPos = event.clientX;
    this.dragStartSize = this.previewWidth();
  }

  // Keyboard resize support
  onResizeKeydown(event: KeyboardEvent, panel: 'sidebar' | 'bottom' | 'preview'): void {
    const step = event.shiftKey ? 50 : 10;
    if (panel === 'sidebar') {
      if (event.key === 'ArrowRight') { this.sidebarWidth.update(w => Math.min(600, w + step)); event.preventDefault(); }
      if (event.key === 'ArrowLeft') { this.sidebarWidth.update(w => Math.max(180, w - step)); event.preventDefault(); }
    } else if (panel === 'bottom') {
      if (event.key === 'ArrowUp') { this.bottomPanelHeight.update(h => Math.min(500, h + step)); event.preventDefault(); }
      if (event.key === 'ArrowDown') { this.bottomPanelHeight.update(h => Math.max(36, h - step)); event.preventDefault(); }
    } else if (panel === 'preview') {
      if (event.key === 'ArrowLeft') { this.previewWidth.update(w => Math.min(800, w + step)); event.preventDefault(); }
      if (event.key === 'ArrowRight') { this.previewWidth.update(w => Math.max(200, w - step)); event.preventDefault(); }
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    if (this.dragging === 'sidebar') {
      const delta = event.clientX - this.dragStartPos;
      this.sidebarWidth.set(Math.max(180, Math.min(600, this.dragStartSize + delta)));
    } else if (this.dragging === 'bottom') {
      const delta = this.dragStartPos - event.clientY;
      this.bottomPanelHeight.set(Math.max(36, Math.min(500, this.dragStartSize + delta)));
    } else if (this.dragging === 'preview') {
      const delta = this.dragStartPos - event.clientX;
      this.previewWidth.set(Math.max(200, Math.min(800, this.dragStartSize + delta)));
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = null;
  }
}
