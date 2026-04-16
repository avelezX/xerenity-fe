/**
 * USDCOP Calculator — fetch TRM and volatility from pysdk backend.
 * Endpoint: GET /usdcop_calculator
 */

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://pysdk.fly.dev';

export interface UsdCopData {
  trm: number;
  vol_diaria: number;
  vol_anual: number;
  fecha: string;
}

export async function fetchUsdCopCalculator(): Promise<UsdCopData> {
  const resp = await fetch(`${BASE_URL}/usdcop_calculator`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch USDCOP calculator: HTTP ${resp.status}`);
  }
  return resp.json();
}
