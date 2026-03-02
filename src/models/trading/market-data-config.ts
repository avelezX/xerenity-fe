import type { MarketDataConfig } from 'src/types/trading';
import { DEFAULT_MARKET_DATA_CONFIG } from 'src/types/trading';

const BASE_URL =
  process.env.NEXT_PUBLIC_PYSDK_URL || 'https://xerenity-pysdk.fly.dev';

const LS_KEY = 'xerenity_market_data_config';

export const fetchMarketDataConfig = async (): Promise<MarketDataConfig> => {
  try {
    const res = await fetch(`${BASE_URL}/pricing/market-data-config`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('endpoint not available');
    const json = await res.json();
    return (json.body ?? json) as MarketDataConfig;
  } catch {
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as MarketDataConfig;
    } catch {
      // ignore storage errors
    }
    return { ...DEFAULT_MARKET_DATA_CONFIG };
  }
};

export const saveMarketDataConfig = async (
  config: MarketDataConfig
): Promise<void> => {
  // Always persist locally first
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
  // Best-effort save to backend (may not exist yet)
  try {
    await fetch(`${BASE_URL}/pricing/market-data-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch {
    // backend not ready yet — localStorage is source of truth
  }
};
