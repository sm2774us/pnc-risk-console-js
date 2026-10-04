import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { map, tap } from 'rxjs';
import { API_BASE_URL } from './interceptors';
const KEY = 'pnc.session.v1';
/** Session state held in signals. Token lives in sessionStorage only (cleared when the tab closes). */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  http = inject(HttpClient);
  base = inject(API_BASE_URL);
  _user = signal(null);
  _token = signal(null);
  user = this._user.asReadonly();
  token = this._token.asReadonly();
  isAuthenticated = computed(() => this._user() !== null);
  permissionSet = computed(() => new Set(this._user()?.permissions ?? []));
  constructor() {
    this.restore();
  }
  can(permission) {
    return this.permissionSet().has(permission);
  }
  login(persona) {
    return this.http.post(`${this.base}/auth/demo-login`, { persona }).pipe(
      tap((r) => {
        this._token.set(r.accessToken);
        this._user.set(r.user);
        this.persist({ token: r.accessToken, user: r.user, expiresAt: Date.now() + r.expiresIn * 1000 });
      }),
      map((r) => r.user),
    );
  }
  logout() {
    this._token.set(null);
    this._user.set(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }
  persist(p) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* private mode: session is memory-only */
    }
  }
  restore() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.expiresAt <= Date.now()) {
        sessionStorage.removeItem(KEY);
        return;
      }
      this._token.set(p.token);
      this._user.set(p.user);
    } catch {
      /* corrupt entry: ignore and require login */
    }
  }
}
