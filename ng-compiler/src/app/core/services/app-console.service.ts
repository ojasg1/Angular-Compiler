import { Injectable, signal, OnDestroy } from '@angular/core';

export interface ConsoleEntry {
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string[];
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class AppConsoleService implements OnDestroy {
  readonly logs = signal<ConsoleEntry[]>([]);
  readonly count = signal(0);
  readonly errorCount = signal(0);

  private listener = (event: MessageEvent) => {
    // Only accept messages from same origin or WebContainer iframe origins
    if (event.origin !== window.location.origin && !event.origin.startsWith('https://')) {
      return;
    }

    const data = event.data;
    if (data?.type !== '__CONSOLE__') return;

    // Validate data structure
    const VALID_METHODS = ['log', 'warn', 'error', 'info', 'debug'];
    const method = VALID_METHODS.includes(data.method) ? data.method : 'log';

    const entry: ConsoleEntry = {
      method,
      args: Array.isArray(data.args) ? data.args.map(String) : [],
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    };

    this.logs.update((prev) => [...prev, entry]);
    this.count.update((c) => c + 1);
    if (entry.method === 'error') {
      this.errorCount.update((c) => c + 1);
    }
  };

  constructor() {
    window.addEventListener('message', this.listener);
  }

  /** Add a log entry programmatically (e.g., from build/compilation events) */
  addEntry(method: ConsoleEntry['method'], ...args: string[]): void {
    const entry: ConsoleEntry = { method, args, timestamp: Date.now() };
    this.logs.update((prev) => [...prev, entry]);
    this.count.update((c) => c + 1);
    if (method === 'error') {
      this.errorCount.update((c) => c + 1);
    }
  }

  clear(): void {
    this.logs.set([]);
    this.count.set(0);
    this.errorCount.set(0);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.listener);
  }
}
