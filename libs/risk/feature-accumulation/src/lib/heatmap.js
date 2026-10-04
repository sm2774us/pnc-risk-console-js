import { ZONES } from '@pnc/shared/domain';
/** Collapses zone x peril rows to one tile per zone for the selected peril (or the worst peril when 'all'). Pure, so it is unit-tested. */
export function buildTiles(rows, peril) {
  const rank = { none: 0, ok: 1, watch: 2, breach: 3 };
  return ZONES.map((z) => {
    const zr = rows.filter((r) => r.zone === z.code && (peril === 'all' || r.peril === peril));
    let worst = null;
    for (const r of zr) if (!worst || r.utilization > worst.utilization) worst = r;
    const status = worst ? worst.status : 'none';
    return {
      code: z.code,
      name: z.name,
      col: z.tile.col,
      row: z.tile.row,
      utilization: worst?.utilization ?? null,
      status,
      tiv: zr.reduce((a, r) => a + r.tiv, 0),
    };
  })
    .sort((a, b) => rank[b.status] - rank[a.status] || a.row - b.row || a.col - b.col)
    .sort((a, b) => a.row - b.row || a.col - b.col);
}
