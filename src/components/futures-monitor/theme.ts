/**
 * Design tokens compartidos para los componentes del Monitor de Futuros.
 * Match exacto con GlobalDateSelector y la tabla del Benchmark.
 */
export const T = {
  ink: '#0f172a',
  inkSoft: '#1e293b',
  muted: '#64748b',
  mutedDim: '#94a3b8',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  hairline: '#cbd5e1',
  hairlineSoft: '#e2e8f0',
  accent: '#9a3412',
  accentSoft: '#fed7aa',
  green: '#15803d',
  greenSoft: '#bbf7d0',
  red: '#b91c1c',
  redSoft: '#fecaca',
  blue: '#1d4ed8',
  purple: '#7c3aed',
} as const;

export const MONO =
  "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export function fmtPrice(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}%`;
}

export function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}`;
}

export function fmtDate(iso: string): string {
  // "2026-05-26" -> "26 may 26"
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [y, mo, d] = iso.split('-');
  return `${d} ${m[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
}

/** Color para spread_vs_front. Rojo si contango fuerte (positivo grande),
 *  verde si backwardation (negativo). Gradiente continuo. */
export function spreadColor(v: number, maxAbs: number): string {
  if (maxAbs === 0) return T.muted;
  const ratio = Math.min(Math.abs(v) / maxAbs, 1);
  if (v > 0) {
    // contango -> tonos amber/rojo
    const alpha = 0.15 + ratio * 0.55;
    return `rgba(185, 28, 28, ${alpha})`;
  }
  // backwardation -> tonos verdes
  const alpha = 0.15 + ratio * 0.55;
  return `rgba(21, 128, 61, ${alpha})`;
}

export function pctColor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return T.muted;
  if (v > 0) return T.green;
  if (v < 0) return T.red;
  return T.muted;
}
