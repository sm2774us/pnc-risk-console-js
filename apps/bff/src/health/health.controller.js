import { __decorate, __param } from 'tslib';
import { Controller, Get, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RequirePermissions, Public } from '../auth/auth';
import { DatasetService } from '../data/dataset.service';
import { APP_ENV } from '../config/env';
let LifecycleState = class LifecycleState {
  draining = false;
  startedAt = Date.now();
  beforeApplicationShutdown() {
    this.draining = true;
  }
};
LifecycleState = __decorate([Injectable()], LifecycleState);
export { LifecycleState };
let HealthController = class HealthController {
  state;
  ds;
  env;
  constructor(state, ds, env) {
    this.state = state;
    this.ds = ds;
    this.env = env;
  }
  /** Liveness: the process is up. Must not depend on downstreams. */
  live() {
    return { status: 'ok' };
  }
  /** Readiness: dataset loaded and not draining. Kubernetes removes the pod from the Service when this fails. */
  ready() {
    if (this.state.draining) throw new ServiceUnavailableException('draining');
    if (this.ds.data.exposures.length === 0) throw new ServiceUnavailableException('dataset not loaded');
    return { status: 'ready' };
  }
  status() {
    return {
      status: this.env.CHAOS_RATE > 0 ? 'degraded' : 'ok',
      version: this.env.APP_VERSION,
      uptimeSec: Math.round((Date.now() - this.state.startedAt) / 1000),
      datasetSize: this.ds.data.exposures.length,
      chaosRate: this.env.CHAOS_RATE,
      node: process.version,
    };
  }
};
__decorate([Public(), Get('healthz')], HealthController.prototype, 'live', null);
__decorate([Public(), Get('readyz')], HealthController.prototype, 'ready', null);
__decorate([Get('status'), RequirePermissions('admin:status')], HealthController.prototype, 'status', null);
HealthController = __decorate(
  [SkipThrottle(), Controller(), __param(0, Inject(LifecycleState)), __param(1, Inject(DatasetService)), __param(2, Inject(APP_ENV))],
  HealthController,
);
export { HealthController };
