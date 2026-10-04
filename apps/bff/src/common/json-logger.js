const ORDER = ['debug', 'info', 'warn', 'error', 'silent'];
/** Structured JSON logger (one line per event) suitable for GCP Cloud Logging / AWS CloudWatch Insights. */
export class JsonLogger {
  level;
  sink;
  constructor(level = 'info', sink = (l) => process.stdout.write(`${l}\n`)) {
    this.level = level;
    this.sink = sink;
  }
  emit(level, message, context, extra) {
    if (ORDER.indexOf(level) < ORDER.indexOf(this.level)) return;
    const base = typeof message === 'object' && message !== null ? message : { msg: String(message) };
    this.sink(JSON.stringify({ time: new Date().toISOString(), severity: level.toUpperCase(), context, ...base, ...extra }));
  }
  log(message, context) {
    this.emit('info', message, context);
  }
  error(message, trace, context) {
    this.emit('error', message, context, trace ? { trace } : undefined);
  }
  warn(message, context) {
    this.emit('warn', message, context);
  }
  debug(message, context) {
    this.emit('debug', message, context);
  }
  verbose(message, context) {
    this.emit('debug', message, context);
  }
  setLogLevels(_levels) {
    /* level is fixed at construction */
  }
}
