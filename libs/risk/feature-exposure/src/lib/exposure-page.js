import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { AllEnterpriseModule, LicenseManager, ModuleRegistry, themeQuartz } from 'ag-grid-enterprise';
import { AuthStore, RiskApi } from '@pnc/risk/data-access';
import { Icon } from '@pnc/shared/ui';
import { COLUMN_DEFS } from './column-defs';
import { ExposureDatasource } from './exposure-datasource';
ModuleRegistry.registerModules([AllEnterpriseModule]);
const STATE_KEY = 'pnc.grid.exposures.v1';
if (typeof window !== 'undefined' && window.__PNC_AG_LICENSE__) LicenseManager.setLicenseKey(window.__PNC_AG_LICENSE__);
/** Theme via the Theming API; CSS variables from Material 3 keep it in sync with dark/light mode. */
export const PNC_GRID_THEME = themeQuartz.withParams({
  fontFamily: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  accentColor: 'var(--mat-sys-primary)',
  backgroundColor: 'var(--mat-sys-surface)',
  foregroundColor: 'var(--mat-sys-on-surface)',
  headerBackgroundColor: 'var(--mat-sys-surface-container)',
  browserColorScheme: 'inherit',
});
@Component({
  selector: 'pnc-exposure-page',
  imports: [AgGridAngular, MatButtonModule, MatSnackBarModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="exp-title">
      <header class="head">
        <div>
          <h1 id="exp-title">Exposure explorer</h1>
          <p class="sub">
            Server-side row model: filtering, sorting, grouping and aggregation run in the BFF over a {{ '50,000' }}-row book; only visible
            blocks are fetched.
          </p>
        </div>
        <div class="actions">
          <button mat-stroked-button type="button" (click)="resetState()"><pnc-icon name="refresh" /> Reset view</button>
          @if (canExport()) {
            <button mat-flat-button type="button" [disabled]="exporting()" (click)="exportCsv()">
              <pnc-icon name="download" /> Export CSV
            </button>
          }
        </div>
      </header>
      <p class="hint" id="grid-hint">
        Drag columns to the group bar, open the side bar for columns and filters, double-click a row for policy detail. Press Enter on a
        focused row to open it.
      </p>
      <ag-grid-angular
        class="grid"
        role="region"
        aria-label="Exposure grid"
        aria-describedby="grid-hint"
        [theme]="theme"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [autoGroupColumnDef]="autoGroup"
        rowModelType="serverSide"
        [cacheBlockSize]="100"
        [maxBlocksInCache]="20"
        [blockLoadDebounceMillis]="150"
        [rowGroupPanelShow]="'always'"
        [sideBar]="sideBar"
        [statusBar]="statusBar"
        [serverSideInitialRowCount]="1"
        [suppressAggFuncInHeader]="false"
        [rowSelection]="{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }"
        (gridReady)="onReady($event)"
        (rowDoubleClicked)="open($event)"
        (filterChanged)="onFilter($event)"
        (columnMoved)="saveState()"
        (columnVisible)="saveState()"
        (columnResized)="saveState()"
        (sortChanged)="saveState()"
        (columnRowGroupChanged)="saveState()"
        (columnValueChanged)="saveState()"
      />
      <p class="count" role="status">{{ rowsInfo() }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: end;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .sub,
    .hint {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
      margin: 0.25rem 0;
    }
    .grid {
      display: block;
      height: calc(100vh - 260px);
      min-height: 420px;
      width: 100%;
    }
    .count {
      font: var(--mat-sys-label-medium);
      margin: 0.5rem 0 0;
    }
  `,
})
export class ExposurePage {
  api = inject(RiskApi);
  auth = inject(AuthStore);
  router = inject(Router);
  snack = inject(MatSnackBar);
  gridApi = null;
  ds = null;
  theme = PNC_GRID_THEME;
  columnDefs = COLUMN_DEFS;
  defaultColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
    enablePivot: false,
    minWidth: 90,
    flex: 1,
  };
  autoGroup = { minWidth: 240, headerName: 'Group', cellRendererParams: { suppressCount: false } };
  sideBar = { toolPanels: ['columns', 'filters'], defaultToolPanel: '' };
  statusBar = {
    statusPanels: [{ statusPanel: 'agTotalRowCountComponent', align: 'left' }, { statusPanel: 'agFilteredRowCountComponent' }],
  };
  exporting = signal(false);
  rowsInfo = signal('Loading…');
  canExport = computed(() => this.auth.can('exposure:export'));
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.ds?.destroy();
      this.gridApi = null;
    });
  }
  onReady(e) {
    this.gridApi = e.api;
    this.ds = new ExposureDatasource(this.api, (m) => {
      this.snack.open(`Could not load rows: ${m}`, 'Dismiss', { duration: 6000 });
      this.rowsInfo.set('Load failed. Adjust filters or retry.');
    });
    this.restoreState();
    e.api.setGridOption('serverSideDatasource', this.ds);
    this.rowsInfo.set('Ready');
  }
  onFilter(_e) {
    this.saveState();
  }
  open(e) {
    const id = e.data?.id;
    if (id) void this.router.navigate(['/policies', id]);
  }
  exportCsv() {
    if (!this.gridApi) return;
    this.exporting.set(true);
    const api = this.gridApi;
    this.api
      .exportCsv$(
        api.getFilterModel(),
        api
          .getColumnState()
          .filter((c) => c.sort)
          .map((c) => ({ colId: c.colId, sort: c.sort })),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'exposures.csv';
          a.click();
          URL.revokeObjectURL(url);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.snack.open('Export failed (permission or service issue).', 'Dismiss', { duration: 6000 });
        },
      });
  }
  resetState() {
    try {
      localStorage.removeItem(STATE_KEY);
    } catch {
      /* ignore */
    }
    this.gridApi?.resetColumnState();
    this.gridApi?.setFilterModel(null);
    this.gridApi?.setRowGroupColumns([]);
  }
  saveState() {
    if (!this.gridApi) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this.gridApi.getColumnState()));
    } catch {
      /* quota/private mode */
    }
  }
  restoreState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) this.gridApi?.applyColumnState({ state: JSON.parse(raw), applyOrder: true });
    } catch {
      /* corrupt state ignored */
    }
  }
}
