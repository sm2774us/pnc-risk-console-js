import './legacy-rating-engine.js'; // side-effect import: the ES5 script registers itself on the global object
// Legacy scripts attach to the global scope instead of exporting; we read it back once, in one place.
const LegacyRatingEngineCtor = globalThis.LegacyRatingEngine;
export class LegacyRatingError extends Error {
  code;
  field;
  constructor(code, field) {
    super(`Legacy rating engine rejected input (${code}${field ? `:${field}` : ''})`);
    this.code = code;
    this.field = field;
    this.name = 'LegacyRatingError';
  }
}
/**
 * Anti-corruption layer around the ES5 engine: typed inputs, Error-based failures with stack traces,
 * and a single place to debug legacy behaviour.
 */
export class LegacyRatingAdapter {
  engine = new LegacyRatingEngineCtor();
  rate(input) {
    try {
      const score = this.engine.score(input);
      return { score, rating: this.engine.grade(score) };
    } catch (thrown) {
      // Legacy code throws strings such as "LEGACY_BAD_NUMBER:hazard".
      if (typeof thrown === 'string') {
        const [code, field] = thrown.split(':');
        throw new LegacyRatingError(code ?? 'LEGACY_UNKNOWN', field);
      }
      throw thrown;
    }
  }
  get invocations() {
    return this.engine.calls;
  }
}
