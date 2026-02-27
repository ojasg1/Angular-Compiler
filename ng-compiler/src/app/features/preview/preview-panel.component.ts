import { Component, inject, computed, viewChild, effect, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { WebContainerService } from '../../core/services/webcontainer.service';
import { CompilationService } from '../../core/services/compilation.service';
import { DomTestBridgeService } from '../../core/services/dom-test-bridge.service';

@Component({
  selector: 'app-preview-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-panel h-100 d-flex flex-column">
      <div class="preview-header d-flex align-items-center justify-content-between px-2 py-1">
        <div class="d-flex align-items-center">
          <i class="bi bi-eye me-1" aria-hidden="true"></i>
          <small class="fw-bold text-uppercase">Preview</small>
          @if (compilation.isCompiling()) {
            <span class="badge bg-warning text-dark ms-2">
              <span class="spinner-border spinner-border-sm me-1" style="width: 10px; height: 10px;"></span>
              Compiling...
            </span>
          }
          @if (webContainer.previewUrl()) {
            <span class="badge bg-success ms-2">Live</span>
          }
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="refreshPreview()"
                aria-label="Refresh preview" title="Refresh preview">
          <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
        </button>
      </div>

      @if (compilation.hasErrors()) {
        <div class="error-overlay p-3">
          <div class="alert alert-danger mb-0">
            <h6 class="alert-heading">
              <i class="bi bi-exclamation-triangle me-1"></i>
              Compilation Errors
            </h6>
            @for (error of compilation.errors(); track $index) {
              <div class="error-item">
                <code class="text-danger">{{ error.file }}:{{ error.line }}:{{ error.column }}</code>
                <span class="ms-2">{{ error.message }}</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="preview-frame flex-grow-1">
        @if (safeUrl()) {
          <iframe [src]="safeUrl()"
                  class="w-100 h-100 border-0"
                  #previewIframe></iframe>
        } @else {
          <div class="d-flex align-items-center justify-content-center h-100 text-muted">
            <div class="text-center">
              <i class="bi bi-display" style="font-size: 3rem;"></i>
              <p class="mt-2">Preview will appear here after the dev server starts</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .preview-panel { background: #fff; }
    .preview-header {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: 11px;
      border-bottom: 1px solid var(--border-color);
      min-height: 32px;
    }
    .preview-frame { background: #fff; }
    .error-overlay {
      background: var(--bg-primary);
      max-height: 200px;
      overflow-y: auto;
    }
    .error-item {
      font-size: 12px;
      padding: 2px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    iframe { background: #fff; }
  `],
})
export class PreviewPanelComponent {
  webContainer = inject(WebContainerService);
  compilation = inject(CompilationService);
  private sanitizer = inject(DomSanitizer);
  private domBridge = inject(DomTestBridgeService);

  readonly previewIframe = viewChild<ElementRef<HTMLIFrameElement>>('previewIframe');

  /** Trusted URL for the iframe — Angular blocks raw URLs in [src] */
  safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.webContainer.previewUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    // Connect iframe to DOM bridge when it becomes available
    effect(() => {
      const iframeRef = this.previewIframe();
      if (iframeRef) {
        this.domBridge.setIframe(iframeRef.nativeElement);
      } else {
        this.domBridge.setIframe(null);
      }
    });
  }

  refreshPreview(): void {
    const url = this.webContainer.previewUrl();
    if (url) {
      this.webContainer.previewUrl.set('');
      setTimeout(() => this.webContainer.previewUrl.set(url), 150);
    }
  }
}
