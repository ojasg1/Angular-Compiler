import { Component, inject, viewChild, ElementRef, effect, computed, ChangeDetectionStrategy } from '@angular/core';
import { WebContainerService } from '../../core/services/webcontainer.service';

@Component({
  selector: 'app-console-output',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="console-panel d-flex flex-column h-100">
      <div class="console-header d-flex align-items-center justify-content-between px-2 py-1">
        <div class="d-flex align-items-center">
          <i class="bi bi-terminal me-1" aria-hidden="true"></i>
          <small class="fw-bold text-uppercase">Terminal</small>
          @if (lineCount() > 0) {
            <span class="badge bg-secondary ms-2" style="font-size: 9px;">{{ lineCount() }} lines</span>
          }
        </div>
        <button class="btn btn-sm btn-outline-secondary" (click)="clear()"
                aria-label="Clear terminal" title="Clear">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </div>
      <div class="console-body flex-grow-1" #consoleBody>
        @for (line of cleanLines(); track $index) {
          <div class="console-line" [class.line-error]="line.type === 'error'"
               [class.line-warn]="line.type === 'warn'"
               [class.line-success]="line.type === 'success'"
               [class.line-info]="line.type === 'info'">{{ line.text }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .console-panel { background: var(--bg-primary); color: var(--text-secondary); }
    .console-header {
      background: var(--bg-tertiary);
      font-size: 11px;
      border-bottom: 1px solid var(--border-color);
      min-height: 32px;
      flex-shrink: 0;
    }
    .console-body {
      overflow-y: auto;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: 12px;
      padding: 8px;
    }
    .console-line {
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-primary);
      line-height: 1.5;
      padding: 0 4px;
    }
    .console-line:hover { background: var(--bg-hover); }
    .line-error { color: var(--log-error); }
    .line-warn { color: var(--log-warn); }
    .line-success { color: #89d185; }
    .line-info { color: var(--log-info); }
  `],
})
export class ConsoleOutputComponent {
  webContainer = inject(WebContainerService);
  private consoleBody = viewChild<ElementRef>('consoleBody');

  cleanLines = computed(() => {
    const raw = this.webContainer.serverOutput();
    return this.parseOutput(raw);
  });

  lineCount = computed(() => this.cleanLines().length);

  constructor() {
    effect(() => {
      this.cleanLines(); // track
      setTimeout(() => {
        const el = this.consoleBody()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    });
  }

  clear(): void {
    this.webContainer.serverOutput.set('');
  }

  private parseOutput(raw: string): { text: string; type: 'normal' | 'error' | 'warn' | 'success' | 'info' }[] {
    // Strip ANSI escape codes
    const stripped = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
                       .replace(/\x1b\][^\x07]*\x07/g, '')   // OSC sequences
                       .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // control chars

    const lines = stripped.split('\n');
    const result: { text: string; type: 'normal' | 'error' | 'warn' | 'success' | 'info' }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, spinner garbage, and noise
      if (!trimmed) continue;
      if (/^[\\|/\-]+$/.test(trimmed)) continue;           // spinner chars only
      if (/^[\s\\|/\-]{0,3}$/.test(trimmed)) continue;     // very short garbage
      if (trimmed === '|' || trimmed === '/' || trimmed === '-' || trimmed === '\\') continue;
      if (trimmed.startsWith('npm warn config')) continue;  // npm config warnings

      // Classify line type
      let type: 'normal' | 'error' | 'warn' | 'success' | 'info' = 'normal';
      const lower = trimmed.toLowerCase();

      if (lower.includes('error') || lower.includes('failed') || lower.includes('err!')) {
        type = 'error';
      } else if (lower.includes('warn') || lower.includes('deprecated')) {
        type = 'warn';
      } else if (lower.includes('ready') || lower.includes('success') || lower.includes('added') || lower.includes('compiled')) {
        type = 'success';
      } else if (lower.includes('installing') || lower.includes('building') || lower.includes('compiling') || trimmed.startsWith('>') || trimmed.startsWith('$')) {
        type = 'info';
      }

      result.push({ text: trimmed, type });
    }

    return result;
  }
}
