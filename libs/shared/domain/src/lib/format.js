const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatUsd = (v) => (v == null || Number.isNaN(v) ? '—' : usd.format(v));
export const formatUsdCompact = (v) => (v == null || Number.isNaN(v) ? '—' : `$${compact.format(v)}`);
export const formatPct = (v) => (v == null || Number.isNaN(v) ? '—' : pct.format(v));
export const formatInt = (v) => (v == null ? '—' : new Intl.NumberFormat('en-US').format(v));
