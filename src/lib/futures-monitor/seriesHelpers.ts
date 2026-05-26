/**
 * Utilities para calcular metricas derivadas sobre las series de tiempo
 * que retorna el backend (TimePoint[]).
 *
 * Estas funciones replican lo que pandas hace en el Streamlit original
 * (rolling mean, rolling std, pct_change, annualized vol). Las hacemos
 * client-side para no inflar el payload del endpoint con series ya
 * derivables.
 */
import type { TimePoint } from './types';

export interface NumberedPoint {
  date: string;
  value: number;
}

const TRADING_DAYS_PER_YEAR = 252;

/** Filtra null/NaN y retorna solo points con valor numerico. */
export function cleanSeries(series: TimePoint[]): NumberedPoint[] {
  return series.flatMap<NumberedPoint>((p) =>
    p.value == null || Number.isNaN(p.value)
      ? []
      : [{ date: p.date, value: p.value }],
  );
}

/** Rolling simple mean. Retorna null en la posicion i si i < window-1. */
export function rollingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/** Rolling std (sample, n-1). */
export function rollingStd(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i += 1) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j += 1) sum += values[j];
    const mean = sum / window;
    let sq = 0;
    for (let j = i - window + 1; j <= i; j += 1) {
      const d = values[j] - mean;
      sq += d * d;
    }
    out[i] = Math.sqrt(sq / (window - 1));
  }
  return out;
}

/** pct_change consecutivo. Retorna serie con N-1 puntos (primer punto NaN). */
export function pctChange(values: number[]): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    if (prev !== 0) out[i] = values[i] / prev - 1;
  }
  return out;
}

/**
 * Volatilidad realizada anualizada en porcentaje:
 *   vol_anualizada = std(returns_diarios) * sqrt(252) * 100
 *
 * Replica el calculo del dashboard original:
 *   ret = s_front.pct_change().dropna()
 *   vol_20 = ret.rolling(20).std() * sqrt(252) * 100
 */
export function realizedVolAnnualized(closes: number[], window: number): (number | null)[] {
  const rets = pctChange(closes);
  // rets[0] = null (no hay previo); el resto son numeros
  const retValues = rets.map((r) => (r == null ? 0 : r));
  const std = rollingStd(retValues, window);
  return std.map((s, i) => {
    if (s == null) return null;
    // ignorar el primer windowsize porque incluye el null inicial
    if (i < window) return null;
    return s * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
  });
}

/** Compone chart-friendly data: { date, close, ma20, ma50, ma200 } */
export function buildPriceChartData(series: NumberedPoint[]): Array<{
  date: string;
  close: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
}> {
  const closes = series.map((p) => p.value);
  const ma20 = rollingMean(closes, 20);
  const ma50 = rollingMean(closes, 50);
  const ma200 = rollingMean(closes, 200);
  return series.map((p, i) => ({
    date: p.date,
    close: p.value,
    ma20: ma20[i],
    ma50: ma50[i],
    ma200: ma200[i],
  }));
}

/** Compone chart-friendly data para vol cone: { date, vol20, vol60 } */
export function buildVolChartData(series: NumberedPoint[]): Array<{
  date: string;
  vol20: number | null;
  vol60: number | null;
}> {
  const closes = series.map((p) => p.value);
  const vol20 = realizedVolAnnualized(closes, 20);
  const vol60 = realizedVolAnnualized(closes, 60);
  return series.map((p, i) => ({
    date: p.date,
    vol20: vol20[i],
    vol60: vol60[i],
  }));
}

/**
 * Spread chart con bandas Bollinger 20D ±2σ.
 *
 * Replica spread_chart_df(spread_series) del Streamlit:
 *   ma = s.rolling(20).mean()
 *   std = s.rolling(20).std()
 *   upper = ma + 2*std
 *   lower = ma - 2*std
 */
export function buildSpreadChartData(series: NumberedPoint[]): Array<{
  date: string;
  value: number;
  ma20: number | null;
  upper2: number | null;
  lower2: number | null;
}> {
  const values = series.map((p) => p.value);
  const ma = rollingMean(values, 20);
  const std = rollingStd(values, 20);
  return series.map((p, i) => {
    const m = ma[i];
    const s = std[i];
    return {
      date: p.date,
      value: p.value,
      ma20: m,
      upper2: m != null && s != null ? m + 2 * s : null,
      lower2: m != null && s != null ? m - 2 * s : null,
    };
  });
}
