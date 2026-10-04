import { signal } from '@angular/core';
/**
 * Classic three-state circuit breaker.
 * closed -> (N consecutive failures) -> open -> (cooldown) -> half-open -> (probe ok) -> closed | (probe fails) -> open
 * The state is a signal so the UI can render it.
 */
export class CircuitBreaker {
  opts;
  state = signal('closed');
  failures = 0;
  openedAt = 0;
  probing = false;
  now;
  constructor(opts) {
    this.opts = opts;
    this.now = opts.now ?? (() => Date.now());
  }
  /** Returns false while open; after the cooldown lets exactly one probe request through. */
  canRequest() {
    if (this.state() === 'closed') return true;
    if (this.state() === 'open') {
      if (this.now() - this.openedAt < this.opts.cooldownMs) return false;
      this.state.set('half-open');
      this.probing = true;
      return true;
    }
    if (this.probing) return false; // half-open: a probe is already in flight
    this.probing = true;
    return true;
  }
  retryAfterMs() {
    return Math.max(0, this.opts.cooldownMs - (this.now() - this.openedAt));
  }
  recordSuccess() {
    this.failures = 0;
    this.probing = false;
    this.state.set('closed');
  }
  recordFailure() {
    this.probing = false;
    this.failures++;
    if (this.state() === 'half-open' || this.failures >= this.opts.failureThreshold) {
      this.openedAt = this.now();
      this.state.set('open');
    }
  }
}
