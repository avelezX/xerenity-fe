/**
 * Risk Management API client — calls the pysdk Django server.
 */
import type { RiskManagementResponse, RollingVarResponse, BenchmarkFactorsResponse } from 'src/types/risk';

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://xerenity-pysdk.fly.dev';

export const fetchRiskManagement = async (
  filterDate: string,
  portfolioId?: string
): Promise<RiskManagementResponse> => {
  const url = `${BASE_URL}/risk_management`;
  const body: Record<string, unknown> = { filter_date: filterDate };
  if (portfolioId) body.portfolio_id = portfolioId;

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
};

export const fetchRollingVar = async (
  filterDate: string
): Promise<RollingVarResponse> => {
  const url = `${BASE_URL}/risk_rolling_var`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter_date: filterDate }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.body ?? json;
};

export const fetchBenchmarkFactors = async (
  filterDate: string
): Promise<BenchmarkFactorsResponse> => {
  const url = `${BASE_URL}/risk_benchmark_factors`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter_date: filterDate }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.body ?? json;
};
