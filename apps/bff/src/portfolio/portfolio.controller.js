import { __decorate, __param } from 'tslib';
import { Body, Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { RETURN_PERIODS, PERILS, applyStress } from '@pnc/shared/domain';
import { z } from 'zod';
import { RequirePermissions } from '../auth/auth';
import { DatasetService } from '../data/dataset.service';
const Rp = z.coerce.number().refine((n) => RETURN_PERIODS.includes(n), 'returnPeriod must be one of 10, 50, 100, 250, 500');
const shockShape = Object.fromEntries(PERILS.map((p) => [p, z.number().min(-0.5).max(2).optional()]));
const StressBody = z.object({ returnPeriod: Rp, perilShocks: z.object(shockShape).strict().default({}) }).strict();
let PortfolioController = class PortfolioController {
  ds;
  constructor(ds) {
    this.ds = ds;
  }
  summary() {
    return this.ds.summary();
  }
  accumulation(rp) {
    return this.ds.accumulation(Rp.default(100).parse(rp));
  }
  /** Server-authoritative stress run (same pure function as the browser preview). */
  stress(body) {
    return applyStress(this.ds.data.cells, StressBody.parse(body), this.ds.data.appetiteScale);
  }
};
__decorate([Get('summary'), RequirePermissions('portfolio:read')], PortfolioController.prototype, 'summary', null);
__decorate(
  [Get('accumulation'), RequirePermissions('portfolio:read'), __param(0, Query('returnPeriod'))],
  PortfolioController.prototype,
  'accumulation',
  null,
);
__decorate(
  [Post('stress'), HttpCode(200), RequirePermissions('stress:run'), __param(0, Body())],
  PortfolioController.prototype,
  'stress',
  null,
);
PortfolioController = __decorate([Controller('portfolio'), __param(0, Inject(DatasetService))], PortfolioController);
export { PortfolioController };
