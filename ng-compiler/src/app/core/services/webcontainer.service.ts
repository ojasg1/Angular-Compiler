import { Injectable, signal } from '@angular/core';
import { WebContainer, FileSystemTree, WebContainerProcess } from '@webcontainer/api';

export type BootStage = 'idle' | 'booting' | 'installing' | 'starting' | 'ready' | 'error';

/** Strip ANSI escape codes + control chars from terminal output */
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')   // CSI sequences (colors, cursor)
    .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences
    .replace(/\x1b[()][A-Z0-9]/g, '')         // charset sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // control chars except \n \r \t
}

@Injectable({ providedIn: 'root' })
export class WebContainerService {
  private container: WebContainer | null = null;
  private devServerProcess: WebContainerProcess | null = null;
  private snapshotLoaded = false;

  readonly stage = signal<BootStage>('idle');
  readonly previewUrl = signal<string>('');
  readonly serverOutput = signal<string>('');
  readonly isReady = signal(false);

  private appendOutput(chunk: string): void {
    const clean = stripAnsi(chunk);
    if (clean.trim()) {
      this.serverOutput.update((prev) => prev + clean);
    }
  }

  private logPhase(label: string): void {
    this.serverOutput.update((prev) => prev + `\n--- ${label} ---\n`);
  }

  async boot(): Promise<void> {
    if (this.container) return;

    try {
      this.stage.set('booting');
      this.logPhase('Booting WebContainer');

      // Try loading snapshot for faster boot
      let snapshotData: ArrayBuffer | null = null;
      try {
        const res = await fetch('/wc-snapshot.bin');
        if (res.ok) {
          snapshotData = await res.arrayBuffer();
          this.appendOutput('Snapshot found, using pre-built dependencies.\n');
        }
      } catch {
        // No snapshot available
      }

      this.container = await WebContainer.boot();
      this.appendOutput('WebContainer booted successfully.\n');

      if (snapshotData) {
        try {
          await this.container.mount(snapshotData as any);
          this.snapshotLoaded = true;
          this.appendOutput('Snapshot mounted successfully.\n');
        } catch {
          this.appendOutput('Snapshot mount failed, will use npm install.\n');
          this.snapshotLoaded = false;
        }
      }

      this.stage.set('installing');
    } catch (err) {
      this.stage.set('error');
      throw err;
    }
  }

  async mountFiles(tree: FileSystemTree): Promise<void> {
    if (!this.container) throw new Error('WebContainer not booted');
    await this.container.mount(tree);
    this.appendOutput('Project files mounted.\n');
  }

  async installDependencies(): Promise<boolean> {
    if (!this.container) throw new Error('WebContainer not booted');

    // Skip npm install if snapshot was loaded
    if (this.snapshotLoaded) {
      this.appendOutput('Skipping npm install (snapshot pre-installed).\n');
      return true;
    }

    this.stage.set('installing');
    this.logPhase('Installing dependencies (npm install)');

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        this.appendOutput(`\nRetrying npm install (attempt ${attempt + 1}/${maxRetries + 1})...\n`);
        await new Promise(r => setTimeout(r, 1000));
      }

      const process = await this.container.spawn('npm', [
        'install',
        '--prefer-offline',
        '--no-audit',
        '--no-fund',
        '--no-optional',
        '--no-package-lock',
      ]);

      process.output.pipeTo(
        new WritableStream({
          write: (chunk) => this.appendOutput(chunk),
        })
      );

      const exitCode = await process.exit;
      if (exitCode === 0) {
        this.appendOutput('\nnpm install completed successfully.\n');
        return true;
      }

      this.appendOutput(`\nnpm install FAILED (exit code ${exitCode})\n`);
    }

    this.stage.set('error');
    return false;
  }

  async startDevServer(): Promise<string> {
    if (!this.container) throw new Error('WebContainer not booted');

    this.stage.set('starting');
    this.logPhase('Starting dev server (Vite)');

    this.devServerProcess = await this.container.spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '3000']);

    this.devServerProcess.output.pipeTo(
      new WritableStream({
        write: (chunk) => this.appendOutput(chunk),
      })
    );

    return new Promise<string>((resolve) => {
      this.container!.on('server-ready', (_port, url) => {
        this.previewUrl.set(url);
        this.isReady.set(true);
        this.stage.set('ready');
        this.appendOutput(`\nDev server ready at ${url}\n`);
        resolve(url);
      });
    });
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.container) throw new Error('WebContainer not booted');

    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      await this.container.spawn('mkdir', ['-p', dir]);
    }
    await this.container.fs.writeFile(path, content);
  }

  async readFile(path: string): Promise<string> {
    if (!this.container) throw new Error('WebContainer not booted');
    return this.container.fs.readFile(path, 'utf-8');
  }

  async spawn(command: string, args: string[]): Promise<{ output: string; exitCode: number }> {
    if (!this.container) throw new Error('WebContainer not booted');

    const process = await this.container.spawn(command, args);
    let output = '';

    process.output.pipeTo(
      new WritableStream({
        write: (chunk) => {
          const clean = stripAnsi(chunk);
          output += clean;
          this.appendOutput(chunk);
        },
      })
    );

    const exitCode = await process.exit;
    return { output, exitCode };
  }

  async teardown(): Promise<void> {
    this.container?.teardown();
    this.container = null;
    this.devServerProcess = null;
    this.stage.set('idle');
    this.previewUrl.set('');
    this.isReady.set(false);
    this.serverOutput.set('');
  }
}
