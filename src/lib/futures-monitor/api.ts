/**
 * API client del endpoint /futures_monitor/sugar del backend Django.
 *
 * El endpoint cachea 5 min server-side; aqui no agregamos cache adicional
 * (TanStack Query lo maneja a nivel de hook si se usa).
 */
import type { LiquidityThresholdsDTO, SugarSnapshot } from './types';

const PYSDK_URL = process.env.NEXT_PUBLIC_PYSDK_URL ?? 'http://localhost:8000';

export interface FetchSugarOptions {
  thresholds?: Partial<LiquidityThresholdsDTO>;
  refresh?: boolean;
}

export async function fetchSugarSnapshot(
  opts: FetchSugarOptions = {},
): Promise<SugarSnapshot> {
  const params = new URLSearchParams();
  const t = opts.thresholds ?? {};
  if (t.min_oi != null) params.set('min_oi', String(t.min_oi));
  if (t.min_adv_20d != null) params.set('min_adv_20d', String(t.min_adv_20d));
  if (t.max_bid_ask_ticks != null) params.set('max_bid_ask_ticks', String(t.max_bid_ask_ticks));
  if (t.max_bid_ask_pct_of_spread != null) params.set('max_bid_ask_pct_of_spread', String(t.max_bid_ask_pct_of_spread));
  if (t.max_stale_business_days != null) params.set('max_stale_business_days', String(t.max_stale_business_days));
  if (t.min_calendar_days_to_expiry != null) params.set('min_calendar_days_to_expiry', String(t.min_calendar_days_to_expiry));
  if (t.fail_on_missing != null) params.set('fail_on_missing', t.fail_on_missing ? 'true' : 'false');
  if (opts.refresh) params.set('refresh', 'true');

  const qs = params.toString();
  const url = `${PYSDK_URL}/futures_monitor/sugar${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`futures_monitor/sugar -> HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<SugarSnapshot>;
}
