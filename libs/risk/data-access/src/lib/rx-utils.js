import { EMPTY, fromEvent, map, startWith, switchMap, timer } from 'rxjs';
/** Emits immediately and then every `periodMs`, but only while the tab is visible (saves load on the BFF). */
export function visiblePoll(periodMs, doc = document) {
  return fromEvent(doc, 'visibilitychange').pipe(
    map(() => !doc.hidden),
    startWith(!doc.hidden),
    switchMap((visible) => (visible ? timer(0, periodMs) : EMPTY)),
  );
}
/** Exponential backoff with jitter; honours a Retry-After hint (seconds) up to a cap. */
export function backoffDelayMs(attempt, baseMs, jitterMs, retryAfterSec, rand = Math.random) {
  if (retryAfterSec && retryAfterSec > 0) return Math.min(5000, retryAfterSec * 1000);
  return Math.min(8000, baseMs * 2 ** (attempt - 1)) + Math.floor(rand() * jitterMs);
}
