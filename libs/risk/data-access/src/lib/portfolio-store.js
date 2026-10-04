import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, map, of, scan, startWith, switchMap } from 'rxjs';
import { toAppError } from './app-error';
import { RiskApi } from './risk-api';
import { visiblePoll } from './rx-utils';
const INITIAL = { status: 'loading', data: null, error: null, at: null };
export const POLL_MS = 60_000;
/**
 * Signal-facing store over an RxJS pipeline:
 *   manual reload + visibility-aware polling -> switchMap (cancels in-flight) -> scan (retains last data on failure).
 */
@Injectable({ providedIn: 'root' })
export class PortfolioStore {
  api = inject(RiskApi);
  reload$ = new BehaviorSubject(undefined);
  vm = toSignal(
    this.reload$.pipe(
      switchMap(() => visiblePoll(POLL_MS)),
      switchMap(() =>
        this.api.summary$().pipe(
          map((r) => ({ status: r.stale ? 'stale' : 'ready', data: r.data, error: null, at: r.at })),
          catchError((e) => of({ status: 'error', error: toAppError(e) })),
        ),
      ),
      scan((prev, next) => ({ ...prev, ...next }), INITIAL),
      startWith(INITIAL),
    ),
    { requireSync: true },
  );
  summary = computed(() => this.vm().data);
  status = computed(() => this.vm().status);
  reload() {
    this.reload$.next();
  }
}
