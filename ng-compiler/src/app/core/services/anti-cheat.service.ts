import { Injectable, signal, inject } from '@angular/core';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AntiCheatService {
  private sessionService = inject(SessionService);

  readonly tabBlurCount = signal(0);
  readonly devToolsDetected = signal(false);
  readonly copyCount = signal(0);

  private listeners: (() => void)[] = [];
  private devToolsCheckInterval: ReturnType<typeof setInterval> | null = null;
  private blurTimestamps: number[] = [];

  startMonitoring(): void {
    this.stopMonitoring();
    this.blurTimestamps = [];

    // Tab visibility changes
    const onVisibility = () => {
      if (document.hidden) {
        this.tabBlurCount.update(n => n + 1);
        this.report('tab_blur');
      } else {
        this.report('tab_focus');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.listeners.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // Window blur/focus with frequent tab-switch detection
    const onBlur = () => {
      this.blurTimestamps.push(Date.now());
      this.report('window_blur');
      this.checkFrequentTabSwitching();
    };
    const onFocus = () => this.report('window_focus');
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    this.listeners.push(
      () => window.removeEventListener('blur', onBlur),
      () => window.removeEventListener('focus', onFocus),
    );

    // Copy detection
    const onCopy = () => {
      this.copyCount.update(n => n + 1);
      const selLen = window.getSelection()?.toString().length || 0;
      this.report('copy', { selectionLength: selLen });
    };

    // Large paste detection
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (text.length > 200) {
        this.report('large_paste', { length: text.length });
      } else {
        this.report('paste', { length: text.length });
      }
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste as EventListener);
    this.listeners.push(
      () => document.removeEventListener('copy', onCopy),
      () => document.removeEventListener('paste', onPaste as EventListener),
    );

    // Context menu
    const onContext = () => {
      this.report('context_menu');
    };
    document.addEventListener('contextmenu', onContext);
    this.listeners.push(() => document.removeEventListener('contextmenu', onContext));

    // Keyboard shortcut blocking (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    const onKeyDown = (e: KeyboardEvent) => {
      const blocked = this.isBlockedShortcut(e);
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        this.report('keyboard_shortcut_blocked', { key: blocked });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    this.listeners.push(() => document.removeEventListener('keydown', onKeyDown, true));

    // DevTools detection — window size heuristic
    this.devToolsCheckInterval = setInterval(() => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if ((widthDiff || heightDiff) && !this.devToolsDetected()) {
        this.devToolsDetected.set(true);
        this.report('devtools_open');
      }
    }, 2000);

    // Improved DevTools detection — console.debug image getter trick
    this.startConsoleDevToolsDetection();

    // Screen capture detection
    this.detectScreenCapture();
  }

  stopMonitoring(): void {
    for (const cleanup of this.listeners) {
      cleanup();
    }
    this.listeners = [];

    if (this.devToolsCheckInterval) {
      clearInterval(this.devToolsCheckInterval);
      this.devToolsCheckInterval = null;
    }
  }

  private isBlockedShortcut(e: KeyboardEvent): string | null {
    // F12
    if (e.key === 'F12') return 'F12';

    // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect)
    if (e.ctrlKey && e.shiftKey) {
      if (e.key === 'I' || e.key === 'i') return 'Ctrl+Shift+I';
      if (e.key === 'J' || e.key === 'j') return 'Ctrl+Shift+J';
      if (e.key === 'C' || e.key === 'c') return 'Ctrl+Shift+C';
    }

    // Ctrl+U (View source)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'U' || e.key === 'u')) return 'Ctrl+U';

    // Cmd+Option+I/J/C on Mac
    if (e.metaKey && e.altKey) {
      if (e.key === 'I' || e.key === 'i') return 'Cmd+Option+I';
      if (e.key === 'J' || e.key === 'j') return 'Cmd+Option+J';
      if (e.key === 'C' || e.key === 'c') return 'Cmd+Option+C';
    }

    return null;
  }

  private checkFrequentTabSwitching(): void {
    const now = Date.now();
    const window30s = now - 30000;
    const recentSwitches = this.blurTimestamps.filter(t => t > window30s);

    if (recentSwitches.length >= 3) {
      this.report('frequent_tab_switching', {
        count: recentSwitches.length,
        windowSeconds: 30,
      });
      // Reset to avoid repeated reports
      this.blurTimestamps = this.blurTimestamps.filter(t => t > now - 5000);
    }
  }

  private startConsoleDevToolsDetection(): void {
    try {
      const element = new Image();
      let devtoolsReported = false;

      Object.defineProperty(element, 'id', {
        get: () => {
          if (!devtoolsReported && !this.devToolsDetected()) {
            devtoolsReported = true;
            this.devToolsDetected.set(true);
            this.report('devtools_open', { method: 'console_getter' });
          }
          return 'devtools-detect';
        },
      });

      // The getter only fires when the console is open and trying to display the object
      const checkInterval = setInterval(() => {
        console.debug(element);
      }, 5000);

      this.listeners.push(() => clearInterval(checkInterval));
    } catch {
      // Silently fail if this detection method isn't supported
    }
  }

  private detectScreenCapture(): void {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
        const checkCapture = async () => {
          try {
            // Check if getDisplayMedia is being used (limited by browser API)
            // This is a best-effort detection — browsers restrict this API
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCapture = devices.some(d => d.kind === 'videoinput' && d.label.toLowerCase().includes('screen'));
            if (hasCapture) {
              this.report('screen_capture_detected');
            }
          } catch {
            // Permission denied or API not available
          }
        };

        const captureInterval = setInterval(checkCapture, 10000);
        this.listeners.push(() => clearInterval(captureInterval));
      }
    } catch {
      // API not available
    }
  }

  private report(type: string, metadata?: Record<string, unknown>): void {
    this.sessionService.reportEvent({
      type,
      timestamp: Date.now(),
      metadata,
    });
  }
}
