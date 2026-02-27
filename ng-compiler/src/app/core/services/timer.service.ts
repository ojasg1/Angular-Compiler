import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TimerService {
  readonly remainingSeconds = signal(0);
  readonly isRunning = signal(false);
  readonly isExpired = signal(false);

  readonly formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  readonly progressPercent = computed(() => {
    if (this.totalSeconds === 0) return 100;
    return (this.remainingSeconds() / this.totalSeconds) * 100;
  });

  private totalSeconds = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onExpireCallback: (() => void) | null = null;

  start(seconds: number, onExpire?: () => void): void {
    this.stop();
    this.totalSeconds = seconds;
    this.remainingSeconds.set(seconds);
    this.isRunning.set(true);
    this.isExpired.set(false);
    this.onExpireCallback = onExpire ?? null;

    this.intervalId = setInterval(() => {
      this.remainingSeconds.update((v) => {
        if (v <= 1) {
          this.expire();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
  }

  private expire(): void {
    this.stop();
    this.isExpired.set(true);
    this.onExpireCallback?.();
  }

  syncWithServer(serverRemainingSeconds: number): void {
    const clientRemaining = this.remainingSeconds();
    const drift = Math.abs(clientRemaining - serverRemainingSeconds);

    // Force-sync if drift exceeds 3 seconds
    if (drift > 3) {
      this.remainingSeconds.set(Math.max(0, serverRemainingSeconds));
    }

    // If server says expired, force expire
    if (serverRemainingSeconds <= 0 && this.isRunning()) {
      this.expire();
    }
  }

  reset(): void {
    this.stop();
    this.remainingSeconds.set(0);
    this.isExpired.set(false);
  }
}
