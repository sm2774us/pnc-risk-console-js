import { __decorate, __param } from 'tslib';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ZONE_BY_CODE, expectedLoss, hazardFor, maskExposure, ratingFor, riskScore, toAccumulationRow } from '@pnc/shared/domain';
import { LegacyRatingAdapter, LegacyRatingError } from '@pnc/shared/legacy-bridge';
import { z } from 'zod';
import { RequirePermissions } from '../auth/auth';
import { DatasetService } from '../data/dataset.service';
import { distinctValues, filterRows, runSsrm } from '../data/query-engine';
const Col = z.object({
  id: z.string().max(40),
  field: z.string().max(40),
  displayName: z.string().max(80).optional(),
  aggFunc: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional(),
});
const SsrmBody = z.object({
  startRow: z.number().int().min(0),
  endRow: z.number().int().min(1),
  rowGroupCols: z.array(Col).max(4).default([]),
  valueCols: z.array(Col).max(12).default([]),
  groupKeys: z.array(z.string().max(80)).max(4).default([]),
  filterModel: z.record(z.string(), z.any()).default({}),
  sortModel: z
    .array(z.object({ colId: z.string().max(40), sort: z.enum(['asc', 'desc']) }))
    .max(4)
    .default([]),
});
const ExportQuery = z.object({ filterModel: z.string().max(4000).optional(), sortModel: z.string().max(1000).optional() });
const EXPORT_CAP = 200_000;
const CSV_COLS = [
  'policyNumber',
  'insured',
  'lob',
  'peril',
  'country',
  'zone',
  'tiv',
  'limit',
  'deductible',
  'premium',
  'incurredLoss',
  'lossRatio',
  'riskScore',
  'rating',
  'status',
  'inception',
  'expiry',
  'underwriter',
];
/** Neutralises CSV/Excel formula injection (=, +, -, @ prefixes) and quotes fields. */
export function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
let ExposureController = class ExposureController {
  ds;
  legacy = new LegacyRatingAdapter();
  constructor(ds) {
    this.ds = ds;
  }
  query(body, req) {
    return runSsrm(this.ds.data.exposures, SsrmBody.parse(body), req.user.permissions);
  }
  distinct(field) {
    return distinctValues(this.ds.data.exposures, field);
  }
  async exportCsv(query, req, res) {
    const q = ExportQuery.parse(query);
    let filterModel = {},
      sortModel = [];
    try {
      filterModel = q.filterModel ? JSON.parse(q.filterModel) : {};
      sortModel = q.sortModel ? JSON.parse(q.sortModel) : [];
    } catch {
      throw new BadRequestException('filterModel/sortModel must be JSON');
    }
    // Reuse validation (and the masked-field guard) by executing a one-row probe.
    runSsrm(
      this.ds.data.exposures,
      { startRow: 0, endRow: 1, rowGroupCols: [], valueCols: [], groupKeys: [], filterModel, sortModel },
      req.user.permissions,
    );
    const rows = filterRows(this.ds.data.exposures, filterModel).slice(0, EXPORT_CAP);
    res.status(200).setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="exposures.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.write(`${CSV_COLS.join(',')}\n`);
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000).map((r) => {
        const m = maskExposure(r, req.user.permissions);
        return CSV_COLS.map((c) => csvCell(m[c])).join(',');
      });
      if (!res.write(`${chunk.join('\n')}\n`)) await new Promise((r) => res.once('drain', r));
    }
    res.end();
  }
  detail(id, req) {
    const e = this.ds.data.byId.get(id);
    if (!e) throw new NotFoundException(`Exposure ${id} not found`);
    const hazard = hazardFor(e.zone, e.peril);
    const modernScore = riskScore({ hazard, lossRatio: e.lossRatio, deductibleRatio: e.deductible / e.tiv });
    let legacy;
    try {
      // Feed values the way the legacy XML feed does: as strings.
      const r = this.legacy.rate({
        hazard: String(hazard),
        lossRatio: String(e.lossRatio),
        tiv: String(e.tiv),
        deductible: String(e.deductible),
      });
      legacy = { score: r.score, rating: r.rating };
    } catch (err) {
      legacy = { error: err instanceof LegacyRatingError ? err.code : 'LEGACY_UNKNOWN' };
    }
    const cell = this.ds.data.cells.find((c) => c.zone === e.zone && c.peril === e.peril);
    const peer = cell ? toAccumulationRow(cell, this.ds.data.appetiteScale) : undefined;
    return {
      exposure: maskExposure(e, req.user.permissions),
      hazard,
      expectedLoss: expectedLoss(e),
      scoring: {
        modern: { score: modernScore, rating: ratingFor(modernScore) },
        legacy,
        reconciled: 'score' in legacy && legacy.score === modernScore,
      },
      zoneName: ZONE_BY_CODE.get(e.zone)?.name ?? e.zone,
      peers: {
        zone: e.zone,
        peril: e.peril,
        policies: peer?.policies ?? 0,
        tiv: peer?.tiv ?? 0,
        utilization: peer?.utilization ?? 0,
        status: peer?.status ?? 'ok',
      },
    };
  }
};
__decorate(
  [Post('query'), HttpCode(200), RequirePermissions('exposure:read'), __param(0, Body()), __param(1, Req())],
  ExposureController.prototype,
  'query',
  null,
);
__decorate(
  [
    Get('distinct/:field'),
    RequirePermissions('exposure:read'),
    Header('Cache-Control', 'private, max-age=300'),
    __param(0, Param('field')),
  ],
  ExposureController.prototype,
  'distinct',
  null,
);
__decorate(
  [Get('export.csv'), RequirePermissions('exposure:export'), __param(0, Query()), __param(1, Req()), __param(2, Res())],
  ExposureController.prototype,
  'exportCsv',
  null,
);
__decorate(
  [Get(':id'), RequirePermissions('exposure:read'), __param(0, Param('id')), __param(1, Req())],
  ExposureController.prototype,
  'detail',
  null,
);
ExposureController = __decorate([Controller('exposures'), __param(0, Inject(DatasetService))], ExposureController);
export { ExposureController };
