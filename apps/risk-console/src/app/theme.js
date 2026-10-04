import { Injectable, signal } from '@angular/core';
const KEY = 'pnc.theme';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  mode = signal(this.read());
  constructor() {
    this.apply(this.mode());
  }
  cycle() {
    const next = this.mode() === 'system' ? 'light' : this.mode() === 'light' ? 'dark' : 'system';
    this.mode.set(next);
    this.apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }
  read() {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }
  apply(m) {
    const el = document.documentElement;
    if (m === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', m);
  }
}
