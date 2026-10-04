import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { catchError, map, of, timer, switchMap } from 'rxjs';
import { ApiHealth, RiskApi, toAppError } from '@pnc/risk/data-access';
@Component({
  selector: 'pnc-status-page',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="page">
    <h1>Service status</h1>
    <mat-card appearance="outlined"
      ><mat-card-content>
        <p>
          Client circuit breaker: <b>{{ health.breaker.state() }}</b>
        </p>
        @if (vm().s; as s) {
          <dl>
            <dt>Status</dt>
            <dd>{{ s.status }}</dd>
            <dt>Version</dt>
            <dd>{{ s.version }}</dd>
            <dt>Node</dt>
            <dd>{{ s.node }}</dd>
            <dt>Uptime</dt>
            <dd>{{ s.uptimeSec }}s</dd>
            <dt>Dataset rows</dt>
            <dd>{{ s.datasetSize }}</dd>
            <dt>Chaos rate</dt>
            <dd>{{ s.chaosRate }}</dd>
          </dl>
        }
        @if (vm().error) {
          <p role="alert">{{ vm().error }}</p>
        }
      </mat-card-content></mat-card
    >
  </section>`,
  styles: `
    dl {
      display: grid;
      grid-template-columns: 9rem 1fr;
      gap: 0.3rem 0.75rem;
    }
    dd {
      margin: 0;
    }
  `,
})
export class StatusPage {
  health = inject(ApiHealth);
  api = inject(RiskApi);
  vm = toSignal(
    timer(0, 10_000).pipe(
      switchMap(() =>
        this.api.status$().pipe(
          map((s) => ({ s, error: null })),
          catchError((e) => of({ s: null, error: toAppError(e).message })),
        ),
      ),
    ),
    { initialValue: { s: null, error: null } },
  );
}
