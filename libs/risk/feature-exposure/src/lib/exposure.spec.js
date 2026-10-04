import { of, throwError, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { COLUMN_DEFS } from './column-defs';
import { ExposureDatasource } from './exposure-datasource';
const req = { startRow: 0, endRow: 100, rowGroupCols: [], valueCols: [], groupKeys: [], filterModel: {}, sortModel: [] };
const params = () => ({ request: req, success: vi.fn(), fail: vi.fn() });
describe('ExposureDatasource', () => {
  it('maps BFF response to grid success', () => {
    const p = params();
    new ExposureDatasource({ queryExposures$: () => of({ rows: [{ id: 'a' }], lastRow: 1, generatedAt: '' }) }).getRows(p);
    expect(p.success).toHaveBeenCalledWith({ rowData: [{ id: 'a' }], rowCount: 1 });
  });
  it('fails the block and reports the error', () => {
    const onError = vi.fn();
    const p = params();
    new ExposureDatasource({ queryExposures$: () => throwError(() => new Error('boom')) }, onError).getRows(p);
    expect(p.fail).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('boom');
  });
  it('cancels in-flight requests on destroy', () => {
    const s = new Subject();
    const ds = new ExposureDatasource({ queryExposures$: () => s.asObservable() });
    ds.getRows(params());
    expect(s.observed).toBe(true);
    ds.destroy();
    expect(s.observed).toBe(false);
  });
});
describe('column model', () => {
  it('declares groupable dimensions and aggregatable measures', () => {
    expect(COLUMN_DEFS.filter((c) => c.enableRowGroup).map((c) => c.field)).toEqual(
      expect.arrayContaining(['lob', 'peril', 'country', 'zone']),
    );
    expect(COLUMN_DEFS.filter((c) => c.enableValue).length).toBeGreaterThanOrEqual(5);
  });
});
