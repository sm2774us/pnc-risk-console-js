import {
  BASE_APPETITE_TIV,
  BREACH_THRESHOLD,
  PERIL_BASE_RATE,
  RETURN_PERIODS,
  RP_MULTIPLIER,
  TAIL_FACTOR,
  WATCH_THRESHOLD,
  ZONE_BY_CODE,
} from './constants';
/*
 * Illustrative, deterministic risk model used for demonstration. It is NOT a vendor catastrophe model.
 * Every function is pure so the same code runs in the browser (stress sliders) and in the BFF (authoritative numbers).
 */
export function hazardFor(zone, peril) {
  return ZONE_BY_CODE.get(zone)?.hazard[peril] ?? 0;
}
/** Annual average loss for an exposure: TIV x base damage rate x zone hazard, bounded by the policy limit. */
export function expectedLoss(e) {
  return Math.min(e.limit, e.tiv * PERIL_BASE_RATE[e.peril] * hazardFor(e.zone, e.peril));
}
/** Probable maximum loss for one accumulation cell at a return period; never exceeds the aggregate limit. */
export function cellPml(cell, rp, severityShock = 0) {
  const hazard = hazardFor(cell.zone, cell.peril);
  const ratio = PERIL_BASE_RATE[cell.peril] * hazard * RP_MULTIPLIER[rp] * TAIL_FACTOR[cell.peril] * (1 + severityShock);
  return Math.min(cell.limit, Math.max(0, cell.tiv * ratio));
}
/** Zone-level cat PML: perils within a zone are summed (conservative); zones are summed (no diversification credit). */
export function probableMaxLoss(cells, rp, shocks = {}) {
  return cells.reduce((sum, c) => sum + cellPml(c, rp, shocks[c.peril] ?? 0), 0);
}
export function appetiteFor(zone, peril, scale = 1) {
  const z = ZONE_BY_CODE.get(zone);
  if (!z) return 0;
  const catLoad = hazardFor(zone, peril) > 1.4 ? 0.85 : 1;
  return BASE_APPETITE_TIV * z.capacity * catLoad * scale;
}
export function utilizationStatus(u) {
  return u >= BREACH_THRESHOLD ? 'breach' : u >= WATCH_THRESHOLD ? 'watch' : 'ok';
}
export function toAccumulationRow(cell, appetiteScale, rp = 100, shocks = {}) {
  const appetite = appetiteFor(cell.zone, cell.peril, appetiteScale);
  const utilization = appetite > 0 ? cell.tiv / appetite : 0;
  const hazard = hazardFor(cell.zone, cell.peril);
  return {
    ...cell,
    appetite,
    utilization,
    status: utilizationStatus(utilization),
    expectedLoss: Math.min(cell.limit, cell.tiv * PERIL_BASE_RATE[cell.peril] * hazard),
    pml100: cellPml(cell, rp, shocks[cell.peril] ?? 0),
  };
}
export function applyStress(cells, req, appetiteScale) {
  const baselinePml = probableMaxLoss(cells, req.returnPeriod);
  const stressedPml = probableMaxLoss(cells, req.returnPeriod, req.perilShocks);
  const rows = cells.map((c) => toAccumulationRow(c, appetiteScale, req.returnPeriod, req.perilShocks));
  const delta = stressedPml - baselinePml;
  return { returnPeriod: req.returnPeriod, baselinePml, stressedPml, delta, deltaPct: baselinePml > 0 ? delta / baselinePml : 0, rows };
}
/** Risk score 0-100 (higher = riskier) combining hazard, loss experience and deductible adequacy. */
export function riskScore(input) {
  const hazardPart = Math.min(45, input.hazard * 15);
  const lossPart = Math.min(40, input.lossRatio * 40);
  const dedPart = Math.max(0, 15 - input.deductibleRatio * 1500);
  return Math.round(Math.min(100, Math.max(0, hazardPart + lossPart + dedPart)));
}
export function ratingFor(score) {
  return score < 25 ? 'A' : score < 45 ? 'B' : score < 65 ? 'C' : score < 82 ? 'D' : 'E';
}
export function allReturnPeriodPml(cells) {
  return Object.fromEntries(RETURN_PERIODS.map((rp) => [rp, probableMaxLoss(cells, rp)]));
}
export function aggregateCells(exposures) {
  const map = new Map();
  for (const e of exposures) {
    const key = `${e.zone}|${e.peril}`;
    const c = map.get(key);
    if (c) {
      c.policies += 1;
      c.tiv += e.tiv;
      c.limit += e.limit;
      c.premium += e.premium;
    } else {
      map.set(key, { zone: e.zone, peril: e.peril, policies: 1, tiv: e.tiv, limit: e.limit, premium: e.premium });
    }
  }
  return [...map.values()].sort((a, b) => a.zone.localeCompare(b.zone) || a.peril.localeCompare(b.peril));
}
/** Recovers the dataset-size appetite scale from server rows so the browser can re-run stress locally. */
export function inferAppetiteScale(rows) {
  for (const r of rows) {
    const unit = appetiteFor(r.zone, r.peril, 1);
    if (unit > 0 && r.appetite > 0) return r.appetite / unit;
  }
  return 1;
}
