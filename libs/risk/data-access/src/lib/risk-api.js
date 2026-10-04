import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, tap, throwError } from 'rxjs';
import { ApiCircuitBreaker, API_BASE_URL, IDEMPOTENT } from './interceptors';
/** Connectivity facts surfaced to the shell (banner) without coupling features to transport details. */
@Injectable({ providedIn: 'root' })
export class ApiHealth {
  breaker = inject(ApiCircuitBreaker);
  staleKeys = signal(new Set());
  anyStale = computed(() => this.staleKeys().size > 0);
  degraded = computed(() => this.breaker.state() !== 'closed' || this.anyStale());
  markStale(key, stale) {
    const next = new Set(this.staleKeys());
    if (stale) next.add(key);
    else next.delete(key);
    this.staleKeys.set(next);
  }
}
@Injectable({ providedIn: 'root' })
export class RiskApi {
  http = inject(HttpClient);
  base = inject(API_BASE_URL);
  health = inject(ApiHealth);
  cache = new Map();
  idempotent = new HttpContext().set(IDEMPOTENT, true);
  /** Stale-while-error: if the call fails after retries, serve the last known good value flagged as stale. */
  withFallback(key, source) {
    return source.pipe(
      map((data) => ({ data, stale: false, at: Date.now() })),
      tap((r) => {
        this.cache.set(key, { data: r.data, at: r.at });
        this.health.markStale(key, false);
      }),
      catchError((err) => {
        const hit = this.cache.get(key);
        if (!hit) return throwError(() => err);
        this.health.markStale(key, true);
        return of({ data: hit.data, stale: true, at: hit.at });
      }),
    );
  }
  summary$() {
    return this.withFallback('summary', this.http.get(`${this.base}/portfolio/summary`));
  }
  accumulation$(rp = 100) {
    return this.withFallback(
      `acc:${rp}`,
      this.http.get(`${this.base}/portfolio/accumulation`, { params: new HttpParams().set('returnPeriod', rp) }),
    );
  }
  stress$(req) {
    return this.http.post(`${this.base}/portfolio/stress`, req, { context: this.idempotent });
  }
  detail$(id) {
    return this.http.get(`${this.base}/exposures/${encodeURIComponent(id)}`);
  }
  queryExposures$(req) {
    return this.http.post(`${this.base}/exposures/query`, req, { context: this.idempotent });
  }
  distinct$(field) {
    return this.http.get(`${this.base}/exposures/distinct/${encodeURIComponent(field)}`);
  }
  exportCsv$(filterModel, sortModel) {
    const params = new HttpParams().set('filterModel', JSON.stringify(filterModel)).set('sortModel', JSON.stringify(sortModel));
    return this.http.get(`${this.base}/exposures/export.csv`, { params, responseType: 'blob' });
  }
  status$() {
    return this.http.get(`${this.base}/status`);
  }
}
