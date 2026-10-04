import { __decorate, __param } from 'tslib';
import { Inject, Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import { TimeoutError, catchError, tap, throwError, timeout } from 'rxjs';
import { APP_ENV } from '../config/env';
/** Bounds latency: no request may hold a worker longer than REQUEST_TIMEOUT_MS. */
let TimeoutInterceptor = class TimeoutInterceptor {
  env;
  constructor(env) {
    this.env = env;
  }
  intercept(_ctx, next) {
    return next.handle().pipe(
      timeout(this.env.REQUEST_TIMEOUT_MS),
      catchError((err) =>
        throwError(() => (err instanceof TimeoutError ? new RequestTimeoutException('Request exceeded time budget') : err)),
      ),
    );
  }
};
TimeoutInterceptor = __decorate([Injectable(), __param(0, Inject(APP_ENV))], TimeoutInterceptor);
export { TimeoutInterceptor };
let AccessLogInterceptor = class AccessLogInterceptor {
  logger = new Logger('access');
  intercept(ctx, next) {
    const req = ctx.switchToHttp().getRequest();
    const started = performance.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log({
            msg: 'request',
            method: req.method,
            path: req.path,
            sub: req.user?.sub,
            correlationId: req.correlationId,
            ms: Math.round(performance.now() - started),
          }),
      }),
    );
  }
};
AccessLogInterceptor = __decorate([Injectable()], AccessLogInterceptor);
export { AccessLogInterceptor };
