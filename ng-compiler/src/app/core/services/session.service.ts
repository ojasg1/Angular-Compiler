import { Injectable, signal, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TimerService } from './timer.service';

export interface SessionStartResponse {
  sessionId: string;
  nonce: string;
  hmacKey: string;
  privateKey: string;
  encryptionKey: string;
  encryptedSpecs: { ciphertext: string; iv: string; authTag: string };
  serverStartTime: number;
  timeLimit: number;
}

export interface HeartbeatResponse {
  serverRemainingSeconds: number;
  status: 'active' | 'expired';
  drift: number;
}

export interface SubmitPayload {
  testResults: {
    total: number;
    passed: number;
    failed: number;
    results: unknown[];
  };
  domTestResults: unknown[];
  signature: string;
  nonce: string;
  clientTimestamp: number;
  codeSnapshot: { path: string; content: string }[];
}

export interface SubmitResponse {
  serverScore: number;
  serverTimestamp: number;
  timeTaken: number;
  warnings: string[];
  submissionId: string;
  difficultyBreakdown: unknown[];
  testResults: unknown[];
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private timer = inject(TimerService);

  readonly sessionId = signal('');
  readonly nonce = signal('');
  readonly hmacKey = signal('');
  readonly privateKey = signal('');
  readonly encryptionKey = signal('');
  readonly encryptedSpecs = signal<{ ciphertext: string; iv: string; authTag: string } | null>(null);
  readonly isSessionActive = signal(false);
  readonly serverVerified = signal(false);

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private baseUrl = environment.serverUrl;

  async startSession(problemId: string, candidateId?: string): Promise<SessionStartResponse> {
    const res = await fetch(`${this.baseUrl}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, candidateId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server unavailable' }));
      throw new Error(err.error || 'Failed to start session');
    }

    const data: SessionStartResponse = await res.json();
    this.sessionId.set(data.sessionId);
    this.nonce.set(data.nonce);
    this.hmacKey.set(data.hmacKey);
    this.privateKey.set(data.privateKey || '');
    this.encryptionKey.set(data.encryptionKey || '');
    this.encryptedSpecs.set(data.encryptedSpecs || null);
    this.isSessionActive.set(true);

    return data;
  }

  startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 15000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async heartbeat(): Promise<void> {
    if (!this.sessionId()) return;

    try {
      const res = await fetch(`${this.baseUrl}/session/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.sessionId(),
        },
        body: JSON.stringify({ clientRemaining: this.timer.remainingSeconds() }),
      });

      if (res.ok) {
        const data: HeartbeatResponse = await res.json();
        this.timer.syncWithServer(data.serverRemainingSeconds);
      }
    } catch {
      // Silent fail — heartbeat is non-critical
    }
  }

  async reportEvent(event: { type: string; timestamp: number; metadata?: Record<string, unknown> }): Promise<void> {
    if (!this.sessionId()) return;

    try {
      await fetch(`${this.baseUrl}/session/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.sessionId(),
        },
        body: JSON.stringify(event),
      });
    } catch {
      // Silent fail
    }
  }

  async submitResults(payload: SubmitPayload): Promise<SubmitResponse> {
    const res = await fetch(`${this.baseUrl}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': this.sessionId(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Submission failed' }));
      throw new Error(err.error || 'Submission failed');
    }

    this.serverVerified.set(true);
    return res.json();
  }

  async requestLlmEval(payload: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/llm/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': this.sessionId(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;
    return res.json();
  }

  async requestLlmHint(payload: unknown): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/llm/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.sessionId(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Hint request failed');
      const data = await res.json();
      return data.hint || 'Try reviewing the Angular documentation for this feature.';
    } catch {
      return 'Check the Angular documentation for the specific API mentioned in the test name.';
    }
  }

  reset(): void {
    this.stopHeartbeat();
    this.sessionId.set('');
    this.nonce.set('');
    this.hmacKey.set('');
    this.privateKey.set('');
    this.encryptionKey.set('');
    this.encryptedSpecs.set(null);
    this.isSessionActive.set(false);
    this.serverVerified.set(false);
  }
}
