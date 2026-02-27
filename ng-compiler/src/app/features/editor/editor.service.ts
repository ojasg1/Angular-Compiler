import { Injectable, signal, computed } from '@angular/core';
import { VirtualFile } from '../../core/models/virtual-file.model';
import { WebContainerService } from '../../core/services/webcontainer.service';
import { getLanguageFromPath } from '../../shared/utils/file-language';

const MAX_OPEN_TABS = 5;

@Injectable({ providedIn: 'root' })
export class FileSystemService {
  private webContainer: WebContainerService | null = null;

  readonly files = signal<VirtualFile[]>([]);
  readonly activeFilePath = signal<string>('');
  readonly openTabs = signal<string[]>([]);
  private writeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  readonly activeFile = computed(() => {
    const path = this.activeFilePath();
    return this.files().find((f) => f.path === path) ?? null;
  });

  readonly openFiles = computed(() => {
    const tabs = this.openTabs();
    const allFiles = this.files();
    return tabs.map((p) => allFiles.find((f) => f.path === p)).filter(Boolean) as VirtualFile[];
  });

  setWebContainerService(service: WebContainerService): void {
    this.webContainer = service;
  }

  loadFiles(virtualFiles: VirtualFile[]): void {
    this.files.set(virtualFiles.map((f) => ({ ...f })));
    // Open the first file by default
    if (virtualFiles.length > 0) {
      this.openFile(virtualFiles[0].path);
    }
  }

  openFile(path: string): void {
    const file = this.files().find((f) => f.path === path);
    if (!file) return;

    this.activeFilePath.set(path);

    const tabs = this.openTabs();
    if (!tabs.includes(path)) {
      let newTabs = [...tabs, path];
      // Enforce max tab limit — close oldest
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs = newTabs.slice(newTabs.length - MAX_OPEN_TABS);
      }
      this.openTabs.set(newTabs);
    }
  }

  closeTab(path: string): void {
    const tabs = this.openTabs().filter((t) => t !== path);
    this.openTabs.set(tabs);

    if (this.activeFilePath() === path) {
      this.activeFilePath.set(tabs.length > 0 ? tabs[tabs.length - 1] : '');
    }
  }

  updateFileContent(path: string, content: string): void {
    const file = this.files().find((f) => f.path === path);
    if (!file || file.readOnly) return;

    this.files.update((files) =>
      files.map((f) => (f.path === path ? { ...f, content, dirty: true } : f))
    );

    // Debounced write to WebContainer
    if (this.writeTimeouts.has(path)) {
      clearTimeout(this.writeTimeouts.get(path)!);
    }

    this.writeTimeouts.set(
      path,
      setTimeout(() => {
        this.writeToContainer(path, content);
        this.writeTimeouts.delete(path);
      }, 1500)
    );
  }

  private async writeToContainer(path: string, content: string): Promise<void> {
    if (!this.webContainer) return;
    try {
      if (path.endsWith('.component.ts')) {
        // Inline templateUrl/styleUrl before writing so Vite can compile
        const inlined = this.inlineTemplateAndStyles(path, content);
        await this.webContainer.writeFile(path, inlined);
        // Also write raw HTML/CSS for test specs that read them separately
      } else {
        await this.webContainer.writeFile(path, content);
      }

      // If this is a .component.html or .component.css, also rewrite the companion .ts
      if (path.endsWith('.component.html') || path.endsWith('.component.css')) {
        const tsPath = path.replace(/\.(html|css)$/, '.ts');
        const tsFile = this.files().find((f) => f.path === tsPath);
        if (tsFile) {
          const inlined = this.inlineTemplateAndStyles(tsFile.path, tsFile.content);
          await this.webContainer.writeFile(tsPath, inlined);
        }
      }

      // Mark as not dirty after successful write
      this.files.update((files) =>
        files.map((f) => (f.path === path ? { ...f, dirty: false } : f))
      );
    } catch (err) {
      console.error(`Failed to write ${path} to WebContainer:`, err);
    }
  }

  /**
   * Takes a .component.ts file's content and replaces templateUrl/styleUrl
   * with inline template/styles using sibling .html/.css file content.
   */
  private inlineTemplateAndStyles(tsPath: string, tsContent: string): string {
    let result = tsContent;
    const dir = tsPath.substring(0, tsPath.lastIndexOf('/'));
    const allFiles = this.files();

    // Replace templateUrl with inline template
    const templateMatch = result.match(/templateUrl\s*:\s*['"]\.\/([^'"]+)['"]/);
    if (templateMatch) {
      const htmlPath = dir + '/' + templateMatch[1];
      const htmlFile = allFiles.find((f) => f.path === htmlPath);
      if (htmlFile) {
        const escaped = htmlFile.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        result = result.replace(templateMatch[0], 'template: `' + escaped + '`');
      }
    }

    // Replace styleUrl with inline styles
    const styleMatch = result.match(/styleUrl\s*:\s*['"]\.\/([^'"]+)['"]/);
    if (styleMatch) {
      const cssPath = dir + '/' + styleMatch[1];
      const cssFile = allFiles.find((f) => f.path === cssPath);
      if (cssFile) {
        const escaped = cssFile.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        result = result.replace(styleMatch[0], 'styles: [`' + escaped + '`]');
      }
    }

    return result;
  }

  async flushAll(): Promise<void> {
    // Cancel pending debounces and write all dirty files immediately
    for (const [, timeout] of this.writeTimeouts) {
      clearTimeout(timeout);
    }
    this.writeTimeouts.clear();

    if (!this.webContainer) return;

    // Write all files, inlining HTML/CSS into their companion .ts files
    const allFiles = this.files();
    const writtenTs = new Set<string>();

    for (const file of allFiles) {
      if (file.path.endsWith('.component.ts')) {
        const inlined = this.inlineTemplateAndStyles(file.path, file.content);
        await this.webContainer.writeFile(file.path, inlined);
        writtenTs.add(file.path);
      }
    }

    // Write HTML/CSS files too (for test specs that read them)
    for (const file of allFiles) {
      if (!file.path.endsWith('.component.ts')) {
        await this.webContainer.writeFile(file.path, file.content);
      }
    }

    // Mark all as not dirty
    this.files.update((files) => files.map((f) => ({ ...f, dirty: false })));
  }

  getFilesByDirectory(): Map<string, VirtualFile[]> {
    const dirMap = new Map<string, VirtualFile[]>();
    for (const file of this.files()) {
      const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(file);
    }
    return dirMap;
  }

  reset(): void {
    for (const timeout of this.writeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.writeTimeouts.clear();
    this.files.set([]);
    this.openTabs.set([]);
    this.activeFilePath.set('');
  }
}
