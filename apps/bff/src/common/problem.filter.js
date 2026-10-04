import { __decorate, __param } from 'tslib';
import { Catch, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { ForbiddenQueryError, QueryError } from '../data/query-engine';
/** RFC 9457 problem+json for every failure; never leaks stack traces or internals. */
let ProblemFilter = class ProblemFilter {
  nodeEnv;
  logger = new Logger('ProblemFilter');
  constructor(nodeEnv) {
    this.nodeEnv = nodeEnv;
  }
  catch(exception, host) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail;
    let errors;
    if (exception instanceof ZodError) {
      status = 400;
      title = 'Validation failed';
      errors = exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    } else if (exception instanceof ForbiddenQueryError) {
      status = 403;
      title = 'Forbidden';
      detail = exception.message;
    } else if (exception instanceof QueryError) {
      status = 400;
      title = 'Invalid query';
      detail = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = exception.name.replace(/Exception$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
      const body = exception.getResponse();
      detail = typeof body === 'string' ? body : body.message;
    }
    if (status >= 500)
      this.logger.error({
        msg: 'unhandled',
        correlationId: req.correlationId,
        path: req.path,
        err: exception instanceof Error ? exception.message : String(exception),
      });
    const problem = {
      type: 'about:blank',
      title,
      status,
      detail: status >= 500 && this.nodeEnv === 'production' ? undefined : detail,
      correlationId: req.correlationId,
      errors,
    };
    res.status(status).type('application/problem+json').json(problem);
  }
};
ProblemFilter = __decorate([Catch(), __param(0, Inject('NODE_ENV'))], ProblemFilter);
export { ProblemFilter };
