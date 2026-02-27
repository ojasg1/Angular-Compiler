import { Injectable, signal } from '@angular/core';

interface DomCommandResult {
  found: boolean;
  tagName?: string;
  textContent?: string;
  innerHTML?: string;
  className?: string;
  value?: string;
  count?: number;
  items?: Array<{
    tagName: string;
    textContent: string;
    className: string;
    value?: string;
  }>;
  clicked?: boolean;
  typed?: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class DomTestBridgeService {
  private iframe: HTMLIFrameElement | null = null;
  private pendingRequests = new Map<string, {
    resolve: (result: DomCommandResult) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  readonly isAvailable = signal(false);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event: MessageEvent) => {
        // Only accept messages from same origin or WebContainer iframe origins
        if (event.origin !== window.location.origin && !event.origin.startsWith('https://')) {
          return;
        }

        if (event.data?.type === '__DOM_RESULT__') {
          const { id, result } = event.data;
          if (typeof id !== 'string') return;
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(id);
            pending.resolve(result);
          }
        }
      });
    }
  }

  setIframe(iframe: HTMLIFrameElement | null): void {
    this.iframe = iframe;
    this.isAvailable.set(!!iframe);
  }

  private sendCommand(
    command: string,
    selector?: string,
    value?: string,
    delay?: number
  ): Promise<DomCommandResult> {
    return new Promise((resolve, reject) => {
      if (!this.iframe?.contentWindow) {
        resolve({ found: false, error: 'iframe not available' });
        return;
      }

      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve({ found: false, error: 'DOM command timed out after 5s' });
      }, 5000);

      this.pendingRequests.set(id, { resolve, reject, timer });

      this.iframe.contentWindow.postMessage({
        type: '__DOM_COMMAND__',
        id,
        command,
        selector,
        value,
        delay,
      }, '*');
    });
  }

  async querySelector(selector: string): Promise<DomCommandResult> {
    return this.sendCommand('querySelector', selector);
  }

  async querySelectorAll(selector: string): Promise<DomCommandResult> {
    return this.sendCommand('querySelectorAll', selector);
  }

  async click(selector: string, delay?: number): Promise<DomCommandResult> {
    return this.sendCommand('click', selector, undefined, delay);
  }

  async type(selector: string, value: string, delay?: number): Promise<DomCommandResult> {
    return this.sendCommand('type', selector, value, delay);
  }

  async wait(delay: number): Promise<DomCommandResult> {
    return this.sendCommand('wait', undefined, undefined, delay);
  }
}
