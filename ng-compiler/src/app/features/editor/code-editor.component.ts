import {
  Component,
  ElementRef,
  viewChild,
  effect,
  inject,
  Injector,
  OnDestroy,
  AfterViewInit,
  signal,
  input,
  output,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FileSystemService } from './editor.service';
import { getLanguageFromPath } from '../../shared/utils/file-language';

declare const monaco: any;

@Component({
  selector: 'app-code-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-container" #editorContainer role="textbox" aria-label="Code editor" aria-multiline="true"></div>
  `,
  styles: [`
    :host { display: block; flex: 1; min-height: 0; overflow: hidden; }
    .editor-container { width: 100%; height: 100%; }
  `],
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  private fileSystem = inject(FileSystemService);
  private injector = inject(Injector);
  private editorContainer = viewChild.required<ElementRef>('editorContainer');

  theme = input<'vs-dark' | 'vs'>('vs-dark');
  contentChange = output<{ path: string; content: string }>();

  private editor: any = null;
  private editorReady = signal(false);
  private models = new Map<string, any>();
  private isSettingContent = false;

  constructor() {
    // Effect to watch active file PATH changes only — not content changes.
    // We use untracked() to read files() so edits don't re-trigger this.
    effect(() => {
      const ready = this.editorReady();
      const activePath = this.fileSystem.activeFilePath(); // tracked — triggers on file switch
      if (!ready || !activePath || !this.editor) return;

      const file = untracked(() => this.fileSystem.files().find(f => f.path === activePath));
      if (!file) return;
      this.openFileInEditor(file.path, file.content, file.readOnly);
    });

    // Effect to watch theme changes
    effect(() => {
      const ready = this.editorReady();
      const t = this.theme();
      if (!ready) return;
      const win = window as any;
      if (win.monaco) win.monaco.editor.setTheme(t);
    });
  }

  ngAfterViewInit(): void {
    this.initMonaco();
  }

  private initMonaco(): void {
    const win = window as any;
    if (win.monaco) {
      this.createEditor();
      return;
    }

    // Configure Monaco AMD loader
    win.require = { paths: { vs: 'assets/monaco-editor/vs' } };

    const loaderScript = document.createElement('script');
    loaderScript.src = 'assets/monaco-editor/vs/loader.js';
    loaderScript.onload = () => {
      win.require(['vs/editor/editor.main'], () => {
        this.createEditor();
      });
    };
    document.head.appendChild(loaderScript);
  }

  private createEditor(): void {
    const win = window as any;
    const monacoApi = win.monaco;

    // Disable TypeScript/JavaScript diagnostics — real errors come from WebContainer's compiler
    monacoApi.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false, // keep basic syntax checking
      noSuggestionDiagnostics: true,
    });
    monacoApi.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
    });

    this.editor = monacoApi.editor.create(this.editorContainer().nativeElement, {
      theme: this.theme(),
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 8 },
    });

    // Listen for content changes
    this.editor.onDidChangeModelContent(() => {
      if (this.isSettingContent) return;
      const model = this.editor.getModel();
      if (model) {
        const path = this.getPathFromModel(model);
        if (path) {
          const content = model.getValue();
          this.fileSystem.updateFileContent(path, content);
          this.contentChange.emit({ path, content });
        }
      }
    });

    // Signal that editor is ready — this triggers the effects in the constructor
    this.editorReady.set(true);
  }

  private openFileInEditor(path: string, content: string, readOnly: boolean): void {
    const win = window as any;
    const monacoApi = win.monaco;
    if (!monacoApi || !this.editor) return;

    let model = this.models.get(path);
    if (!model) {
      const language = getLanguageFromPath(path);
      const uri = monacoApi.Uri.parse(`file:///${path}`);
      model = monacoApi.editor.createModel(content, language, uri);
      this.models.set(path, model);
    } else {
      // Update content if changed externally
      this.isSettingContent = true;
      if (model.getValue() !== content) {
        model.setValue(content);
      }
      this.isSettingContent = false;
    }

    this.editor.setModel(model);
    this.editor.updateOptions({ readOnly });

    // Enforce max open models (5)
    if (this.models.size > 5) {
      const openTabs = this.fileSystem.openTabs();
      for (const [p, m] of this.models) {
        if (!openTabs.includes(p) && p !== path) {
          m.dispose();
          this.models.delete(p);
          break;
        }
      }
    }
  }

  private getPathFromModel(model: any): string | null {
    for (const [path, m] of this.models) {
      if (m === model) return path;
    }
    return null;
  }

  ngOnDestroy(): void {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.editor?.dispose();
  }
}
