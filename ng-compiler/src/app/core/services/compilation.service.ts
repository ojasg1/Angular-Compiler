import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { CompilationError } from '../models/compilation-error.model';
import { WebContainerService } from './webcontainer.service';
import { AppConsoleService } from './app-console.service';

@Injectable({ providedIn: 'root' })
export class CompilationService {
  private webContainer = inject(WebContainerService);
  private appConsole = inject(AppConsoleService);

  readonly errors = signal<CompilationError[]>([]);
  readonly isCompiling = signal(false);
  readonly hasErrors = computed(() => this.errors().length > 0);

  private lastOutput = '';
  private hasLoggedReady = false;

  constructor() {
    // Watch server output for compilation errors
    effect(() => {
      const output = this.webContainer.serverOutput();
      if (output === this.lastOutput) return;

      const newContent = output.slice(this.lastOutput.length);
      this.lastOutput = output;

      this.parseOutput(newContent);
    });

    // Log stage changes to the console
    effect(() => {
      const stage = this.webContainer.stage();
      switch (stage) {
        case 'installing':
          this.appConsole.addEntry('info', 'Installing dependencies...');
          break;
        case 'starting':
          this.appConsole.addEntry('info', 'Starting dev server...');
          break;
        case 'ready':
          if (!this.hasLoggedReady) {
            this.appConsole.addEntry('info', 'Dev server ready. Compiling your Angular app...');
            this.hasLoggedReady = true;
          }
          break;
        case 'error':
          this.appConsole.addEntry('error', 'Environment setup failed. Check your code for errors.');
          break;
      }
    });
  }

  // Map common Angular error codes to friendly messages
  private static readonly ANGULAR_ERROR_MAP: Record<string, string> = {
    'NG8002': "Can't bind to property — check import or spelling",
    'NG8001': 'Unknown element — did you import the component?',
    'NG8003': 'Unknown attribute — check the directive or property name',
    'NG0300': 'Multiple components match this element selector',
    'NG0301': 'Export not found — check the exportAs name',
    'NG0302': 'Pipe not found — did you import it?',
    'NG2003': 'Missing required input property',
    'NG5002': 'Template parse error',
  };

  private parseOutput(chunk: string): void {
    // Detect compilation start (Vite + Angular CLI patterns)
    if (chunk.includes('Compiling') || chunk.includes('Building') || chunk.includes('hmr update') || chunk.includes('page reload')) {
      this.isCompiling.set(true);
    }

    // Detect successful compilation
    if (chunk.includes('Compiled successfully') || chunk.includes('Build at:') ||
        chunk.includes('ready in') || chunk.includes('page reload') || chunk.includes('hmr update')) {
      this.isCompiling.set(false);
      if (this.errors().length > 0) {
        this.appConsole.addEntry('info', 'Compilation successful. Errors resolved.');
      }
      this.errors.set([]);
      return;
    }

    // Detect compilation failure
    if (chunk.includes('Failed to compile') || chunk.includes('Build failed') || chunk.includes('error during build')) {
      this.isCompiling.set(false);
    }

    const newErrors: CompilationError[] = [];
    const seen = new Set<string>();

    const addError = (err: CompilationError) => {
      const key = `${err.file}:${err.line}:${err.column}`;
      if (seen.has(key)) return;
      seen.add(key);

      // Enhance Angular error messages
      const ngMatch = err.message.match(/NG(\d+)/);
      if (ngMatch) {
        const code = 'NG' + ngMatch[1];
        const friendly = CompilationService.ANGULAR_ERROR_MAP[code];
        if (friendly) {
          err.message = `${code}: ${friendly} — ${err.message}`;
        }
      }

      newErrors.push(err);
    };

    let match;

    // Parse TypeScript errors: src/app/file.ts:10:5 - error TS2339: ...
    const tsErrorRegex = /([^\s]+\.\w+):(\d+):(\d+)\s*-?\s*(?:error\s+\w+:\s*)?(.+)/g;
    while ((match = tsErrorRegex.exec(chunk)) !== null) {
      if (match[4]) {
        addError({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          message: match[4].trim(),
          severity: 'error',
        });
      }
    }

    // Parse Vite/esbuild errors: ERROR: ... (file.ts:10:5)
    const viteErrorRegex = /ERROR[:\s]+(.+?)(?:\s+\(([^)]+\.\w+):(\d+):(\d+)\))?$/gm;
    while ((match = viteErrorRegex.exec(chunk)) !== null) {
      addError({
        file: match[2] || 'unknown',
        line: match[3] ? parseInt(match[3], 10) : 0,
        column: match[4] ? parseInt(match[4], 10) : 0,
        message: match[1].trim(),
        severity: 'error',
      });
    }

    // Parse Angular template errors: NG8002: Can't bind to 'xxx'
    const ngErrorRegex = /(NG\d+):\s*(.+?)(?:\s+\(([^)]+):(\d+):(\d+)\))?$/gm;
    while ((match = ngErrorRegex.exec(chunk)) !== null) {
      addError({
        file: match[3] || 'template',
        line: match[4] ? parseInt(match[4], 10) : 0,
        column: match[5] ? parseInt(match[5], 10) : 0,
        message: `${match[1]}: ${match[2].trim()}`,
        severity: 'error',
      });
    }

    // Parse missing module errors
    const moduleRegex = /(?:Cannot find module|Module not found)[:\s]*['"]([^'"]+)['"]/g;
    while ((match = moduleRegex.exec(chunk)) !== null) {
      addError({
        file: 'unknown',
        line: 0,
        column: 0,
        message: `Module not found: '${match[1]}'`,
        severity: 'error',
      });
    }

    // Parse type assignment errors
    const typeRegex = /Type '([^']+)' is not assignable to type '([^']+)'/g;
    while ((match = typeRegex.exec(chunk)) !== null) {
      addError({
        file: 'unknown',
        line: 0,
        column: 0,
        message: `Type '${match[1]}' is not assignable to type '${match[2]}'`,
        severity: 'error',
      });
    }

    // Parse decorator errors
    const decoratorRegex = /Unable to resolve signature of (class|property) decorator/g;
    while ((match = decoratorRegex.exec(chunk)) !== null) {
      addError({
        file: 'unknown',
        line: 0,
        column: 0,
        message: `Decorator error: Unable to resolve ${match[1]} decorator signature`,
        severity: 'error',
      });
    }

    // Parse warnings (Vite warnings)
    const warnRegex = /WARNING[:\s]+(.+?)(?:\s+\(([^)]+\.\w+):(\d+):(\d+)\))?$/gm;
    while ((match = warnRegex.exec(chunk)) !== null) {
      addError({
        file: match[2] || 'unknown',
        line: match[3] ? parseInt(match[3], 10) : 0,
        column: match[4] ? parseInt(match[4], 10) : 0,
        message: match[1].trim(),
        severity: 'warning',
      });
    }

    if (newErrors.length > 0) {
      this.errors.set(newErrors);
      for (const err of newErrors) {
        const method = err.severity === 'warning' ? 'warn' : 'error';
        this.appConsole.addEntry(method, `${err.file}:${err.line}:${err.column} - ${err.message}`);
      }
    }
  }

  clearErrors(): void {
    this.errors.set([]);
  }
}
