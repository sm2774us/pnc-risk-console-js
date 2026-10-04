import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { buildAppModule } from './app.module';
import { chaos, correlationId } from './common/http-middleware';
import { JsonLogger } from './common/json-logger';
import { loadEnv } from './config/env';
/** Single composition root shared by main.js and the integration tests (what we test is what we ship). */
export async function createApp(overrides = process.env) {
  const env = loadEnv(overrides);
  const app = await NestFactory.create(buildAppModule(env), {
    logger: new JsonLogger(env.LOG_LEVEL),
    bufferLogs: false,
  });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(correlationId);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(compression());
  app.use(chaos(env.CHAOS_RATE));
  app.useBodyParser('json', { limit: '64kb' });
  app.enableCors({
    origin: env.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id', 'retry-after', 'x-chaos'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz'] });
  app.enableShutdownHooks();
  return { app, env };
}
