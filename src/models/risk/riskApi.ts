/**
 * Risk Management API client — calls the pysdk Django server.
 */
import type { RiskManagementResponse, RollingVarResponse, BenchmarkFactorsResponse, ExposureResponse, ExposureParams } from 'src/types/risk';

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://xerenity-pysdk.fly.dev';

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.body ?? json;
}

export const fetchRiskManagement = (
  filterDate: string,
  portfolioId?: string
): Promise<RiskManagementResponse> => {
  const body: Record<string, unknown> = { filter_date: filterDate };
  if (portfolioId) body.portfolio_id = portfolioId;
  return postJson(`${BASE_URL}/risk_management`, body);
};

export const fetchRollingVar = (
  filterDate: string,
  confidenceLevel = 0.99
): Promise<RollingVarResponse> =>
  postJson(`${BASE_URL}/risk_rolling_var`, { filter_date: filterDate, confidence_level: confidenceLevel });

export const fetchBenchmarkFactors = (
  filterDate: string,
  confidenceLevel = 0.99
): Promise<BenchmarkFactorsResponse> =>
  postJson(`${BASE_URL}/risk_benchmark_factors`, { filter_date: filterDate, confidence_level: confidenceLevel });

export const fetchExposure = (
  filterDate: string,
  exposureParams: ExposureParams
): Promise<ExposureResponse> =>
  postJson(`${BASE_URL}/risk_exposure`, { filter_date: filterDate, exposure_params: exposureParams });
