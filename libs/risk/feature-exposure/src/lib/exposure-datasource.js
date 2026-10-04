/**
 * Bridges Ag-Grid's server-side row model to the BFF. Each block request is an RxJS stream;
 * destroying the datasource (or the grid refreshing) unsubscribes in-flight calls (no orphan requests).
 */
export class ExposureDatasource {
  api;
  onError;
  inflight = new Set();
  constructor(api, onError = () => undefined) {
    this.api = api;
    this.onError = onError;
  }
  getRows(params) {
    const req = params.request;
    const sub = this.api.queryExposures$(req).subscribe({
      next: (res) => {
        params.success({ rowData: res.rows, rowCount: res.lastRow });
      },
      error: (e) => {
        params.fail();
        this.onError(e instanceof Error ? e.message : 'Query failed');
      },
    });
    this.inflight.add(sub);
    sub.add(() => this.inflight.delete(sub));
  }
  destroy() {
    for (const s of this.inflight) s.unsubscribe();
    this.inflight.clear();
  }
}
