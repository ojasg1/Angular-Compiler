import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { VirtualFile } from '../../core/models/virtual-file.model';
import { getFileIcon } from '../../shared/utils/file-language';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tab-bar d-flex align-items-center" role="tablist" aria-label="Open files">
      @for (file of files(); track file.path) {
        <button class="tab-item d-flex align-items-center"
             role="tab"
             [attr.aria-selected]="file.path === activeFilePath()"
             [class.active]="file.path === activeFilePath()"
             (click)="tabClick.emit(file.path)">
          <i [class]="getIcon(file.path)" class="me-1" aria-hidden="true"></i>
          <span class="tab-name">{{ getFileName(file.path) }}</span>
          @if (file.dirty) {
            <span class="dirty-dot ms-1" aria-label="Unsaved changes"></span>
          }
          @if (!file.readOnly) {
            <button class="btn-close-tab ms-2" (click)="closeTab($event, file.path)"
                    [attr.aria-label]="'Close ' + getFileName(file.path)">
              <i class="bi bi-x" aria-hidden="true"></i>
            </button>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    .tab-bar {
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;
      min-height: 36px;
    }
    .tab-item {
      padding: 6px 12px;
      cursor: pointer;
      color: var(--text-muted);
      font-size: 13px;
      border: none;
      border-right: 1px solid var(--border-color);
      border-bottom: 2px solid transparent;
      background: none;
      white-space: nowrap;
      user-select: none;
      transition: background 0.15s;
    }
    .tab-item:hover { background: var(--bg-hover); color: var(--text-secondary); }
    .tab-item:focus-visible { outline: 1px solid var(--accent-color); outline-offset: -1px; }
    .tab-item.active { background: var(--bg-primary); color: var(--text-bright); border-bottom-color: var(--accent-color); }
    .tab-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
    .dirty-dot {
      width: 8px; height: 8px;
      background: #e8a317;
      border-radius: 50%;
      display: inline-block;
    }
    .btn-close-tab {
      background: none; border: none; color: var(--text-muted);
      padding: 2px 4px; font-size: 14px; line-height: 1; cursor: pointer;
      min-width: 20px; min-height: 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 3px;
    }
    .btn-close-tab:hover { color: var(--text-bright); background: var(--bg-hover); }
    .btn-close-tab:focus-visible { outline: 1px solid var(--accent-color); }
    .tab-item i { font-size: 14px; }
  `],
})
export class TabBarComponent {
  files = input.required<VirtualFile[]>();
  activeFilePath = input.required<string>();
  tabClick = output<string>();
  tabClose = output<string>();

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  getIcon(path: string): string {
    return getFileIcon(path);
  }

  closeTab(event: Event, path: string): void {
    event.stopPropagation();
    this.tabClose.emit(path);
  }
}
