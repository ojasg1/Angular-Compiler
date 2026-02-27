import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FileSystemService } from '../editor/editor.service';
import { VirtualFile } from '../../core/models/virtual-file.model';
import { getFileIcon } from '../../shared/utils/file-language';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: VirtualFile;
}

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="file-tree" role="tree" aria-label="File explorer">
      <div class="tree-header px-2 py-1 d-flex align-items-center">
        <i class="bi bi-folder2-open me-1" aria-hidden="true"></i>
        <small class="fw-bold text-uppercase">Explorer</small>
      </div>
      @for (node of tree(); track node.path) {
        <ng-container *ngTemplateOutlet="treeNodeTpl; context: { $implicit: node, depth: 0 }" />
      }
    </div>

    <ng-template #treeNodeTpl let-node let-depth="depth">
      @if (node.isDir) {
        <button class="tree-item dir" [style.padding-left.px]="depth * 16 + 8"
             (click)="toggleDir(node.path)"
             role="treeitem"
             [attr.aria-expanded]="isExpanded(node.path)"
             [attr.aria-selected]="false"
             [attr.aria-label]="node.name + ' folder'">
          <i [class]="isExpanded(node.path) ? 'bi bi-chevron-down' : 'bi bi-chevron-right'" class="me-1" aria-hidden="true"></i>
          <i class="bi bi-folder-fill me-1 text-warning" aria-hidden="true"></i>
          <span>{{ node.name }}</span>
        </button>
        @if (isExpanded(node.path)) {
          <div role="group">
            @for (child of node.children; track child.path) {
              <ng-container *ngTemplateOutlet="treeNodeTpl; context: { $implicit: child, depth: depth + 1 }" />
            }
          </div>
        }
      } @else {
        <button class="tree-item file" [style.padding-left.px]="depth * 16 + 8"
             [class.active]="node.path === fileSystem.activeFilePath()"
             (click)="fileSystem.openFile(node.path)"
             role="treeitem"
             [attr.aria-selected]="node.path === fileSystem.activeFilePath()"
             [attr.aria-label]="node.name + (node.file?.readOnly ? ' (read-only)' : '') + (node.file?.dirty ? ' (unsaved changes)' : '')">
          <i [class]="getIcon(node.path)" class="me-1" aria-hidden="true"></i>
          <span>{{ node.name }}</span>
          @if (node.file?.readOnly) {
            <i class="bi bi-lock-fill ms-1 text-muted" style="font-size: 10px;" aria-hidden="true"></i>
          }
          @if (node.file?.dirty) {
            <span class="dirty-indicator ms-1" aria-hidden="true"></span>
          }
        </button>
      }
    </ng-template>
  `,
  styles: [`
    .file-tree {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 13px;
      height: 100%;
      overflow-y: auto;
      user-select: none;
    }
    .tree-header {
      background: var(--bg-tertiary);
      color: var(--text-tertiary);
      font-size: 11px;
      border-bottom: 1px solid var(--border-color);
    }
    .tree-item {
      padding: 3px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      white-space: nowrap;
      background: none;
      border: none;
      color: inherit;
      width: 100%;
      text-align: left;
      font: inherit;
    }
    .tree-item:hover { background: var(--bg-hover); }
    .tree-item:focus-visible { outline: 1px solid var(--accent-color); outline-offset: -1px; }
    .tree-item.active { background: var(--bg-active); color: var(--text-bright); }
    .tree-item i { font-size: 14px; flex-shrink: 0; }
    .dirty-indicator {
      width: 6px; height: 6px;
      background: #e8a317;
      border-radius: 50%;
      display: inline-block;
    }
  `],
})
export class FileTreeComponent {
  fileSystem = inject(FileSystemService);

  private expandedDirs = new Set<string>(['src', 'src/app']);

  tree = computed(() => this.buildTree(this.fileSystem.files()));

  private buildTree(files: VirtualFile[]): TreeNode[] {
    const root: TreeNode[] = [];
    const dirMap = new Map<string, TreeNode>();

    for (const file of files) {
      const parts = file.path.split('/');
      let currentChildren = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const dirPath = parts.slice(0, i + 1).join('/');
        let dirNode = dirMap.get(dirPath);
        if (!dirNode) {
          dirNode = { name: parts[i], path: dirPath, isDir: true, children: [] };
          dirMap.set(dirPath, dirNode);
          currentChildren.push(dirNode);
        }
        currentChildren = dirNode.children;
      }

      currentChildren.push({
        name: parts[parts.length - 1],
        path: file.path,
        isDir: false,
        children: [],
        file,
      });
    }

    return root;
  }

  isExpanded(path: string): boolean {
    return this.expandedDirs.has(path);
  }

  toggleDir(path: string): void {
    if (this.expandedDirs.has(path)) {
      this.expandedDirs.delete(path);
    } else {
      this.expandedDirs.add(path);
    }
  }

  getIcon(path: string): string {
    return getFileIcon(path);
  }
}
