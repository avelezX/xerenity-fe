/**
 * Risk Management API client — calls the pysdk Django server.
 * Sends Supabase JWT in Authorization header for multi-tenant isolation.
 * Super admins can pass companyId to view other companies' portfolios.
 */
import type {
  RiskManagementResponse, RollingVarResponse, BenchmarkFactorsResponse,
  ExposureResponse, ExposureParams,
  FuturesPortfolioResponse, NewFuturesPosition, FuturesRollParams, FuturesCloseParams, FuturesEditParams,
} from 'src/types/risk';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const BASE_URL = process.env.NEXT_PUBLIC_PYSDK_URL || 'https://pysdk.fly.dev';
const supabase = createClientComponentClient();

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.body ?? json;
}

/** Helper: add company_id to body if provided (super_admin company selector) */
function withCompany(base: Record<string, unknown>, companyId?: string): Record<string, unknown> {
  if (companyId) return { ...base, company_id: companyId };
  return base;
}

export const fetchRiskManagement = (
  filterDate: string,
  portfolioId?: string,
  companyId?: string,
): Promise<RiskManagementResponse> => {
  const body: Record<string, unknown> = { filter_date: filterDate };
  if (portfolioId) body.portfolio_id = portfolioId;
  return postJson(`${BASE_URL}/risk_management`, withCompany(body, companyId));
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
  exposureParams: ExposureParams,
  companyId?: string,
): Promise<ExposureResponse> =>
  postJson(`${BASE_URL}/risk_exposure`, withCompany({ filter_date: filterDate, exposure_params: exposureParams }, companyId));

// ── Futures Portfolio ──

export const fetchFuturesPortfolio = (
  filterDate: string,
  activeOnly = true,
  companyId?: string,
): Promise<FuturesPortfolioResponse> =>
  postJson(`${BASE_URL}/risk_futures_portfolio`, withCompany({ filter_date: filterDate, active_only: activeOnly }, companyId));

export const upsertFuturesPositions = (
  filterDate: string,
  positions: NewFuturesPosition[],
  companyId?: string,
): Promise<{ status: string; count: number }> =>
  postJson(`${BASE_URL}/risk_futures_portfolio_upsert`, withCompany({ filter_date: filterDate, positions }, companyId));

export const rollFuturesPosition = (
  filterDate: string,
  params: FuturesRollParams,
  companyId?: string,
): Promise<{ status: string; closed_position_id: string; new_position: unknown }> =>
  postJson(`${BASE_URL}/risk_futures_portfolio_roll`, withCompany({ filter_date: filterDate, ...params }, companyId));

export const closeFuturesPosition = (
  filterDate: string,
  params: FuturesCloseParams,
  companyId?: string,
): Promise<{ status: string; position_id: string }> =>
  postJson(`${BASE_URL}/risk_futures_portfolio_close`, withCompany({ filter_date: filterDate, ...params }, companyId));

export const deleteFuturesPosition = (
  filterDate: string,
  positionId: string,
  companyId?: string,
): Promise<{ status: string; position_id: string }> =>
  postJson(`${BASE_URL}/risk_futures_portfolio_delete`, withCompany({ filter_date: filterDate, position_id: positionId }, companyId));

export const editFuturesPosition = (
  filterDate: string,
  params: FuturesEditParams,
  companyId?: string,
): Promise<{ status: string; position_id: string; updated_fields: string[] }> =>
  postJson(`${BASE_URL}/risk_futures_portfolio_edit`, withCompany({ filter_date: filterDate, ...params }, companyId));
