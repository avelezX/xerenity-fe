/**
 * Bulk loan summary fetcher — Phase 3.1 (epic #300).
 *
 * Calls the existing Supabase RPC `xerenity.ibr_cash_flow_by_loans` (despite
 * the name, this function handles ALL loan types: fija, ibr, uvr — `loan_get_data`
 * inside it queries `loans.loan` without filtering by type). The RPC delegates
 * to pysdk's `/all_loans` endpoint, which runs the full
 * `LoanPortfolioAnalyzer` server-side and returns:
 *
 *   1. One row per bank with weighted IRR/tenor/duration aggregates.
 *   2. One "totals" row with `bank = 0` and global aggregates (sum across banks).
 *
 * The shape matches `LoanData` in `src/types/loans.ts` exactly, so the
 * frontend `buildPortfolioSummary` becomes redundant for this call path.
 *
 * Why this matters for production latency:
 * - Today the FE makes N (e.g. 68) round-trips to compute the same summary.
 * - This RPC reduces it to ONE round-trip.
 * - User reports a "ratico" before the dashboard fills in — that latency
 *   is exactly N × (network RTT + Postgres compute). Bulk drops the multiplier.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LoanData } from 'src/types/loans';
import {
  telemetry,
  combineAbortSignals,
  DEFAULT_FETCH_TIMEOUT_MS,
  isAbortError,
} from 'src/lib/telemetry';

const SCHEMA = 'xerenity';
const RPC_KEY = 'ibr_cash_flow_by_loans';
const supabase = createClientComponentClient();

export type BulkLoanSummaryResponse = {
  /** Per-bank rows; the row with `bank === '0'` is the global totals. */
  data: LoanData[];
  error: string | undefined;
};

export interface FetchBulkLoanSummaryOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Server can return `bank` as the integer 0 (totals row, from a positional
 *  index) or a real bank-name string. Normalize both into `LoanData`. */
const normalizeRow = (raw: Record<string, unknown>): LoanData => {
  const { bank } = raw;
  return {
    bank: bank === 0 ? '0' : String(bank ?? ''),
    loan_ids: Array.isArray(raw.loan_ids) ? (raw.loan_ids as string[]) : [],
    loan_count: Number(raw.loan_count ?? 0),
    total_value: Number(raw.total_value ?? 0),
    accrued_interest: Number(raw.accrued_interest ?? 0),
    average_irr: Number(raw.average_irr ?? 0),
    average_tenor: Number(raw.average_tenor ?? 0),
    average_duration: Number(raw.average_duration ?? 0),
    total_value_fija: Number(raw.total_value_fija ?? 0),
    total_value_ibr: Number(raw.total_value_ibr ?? 0),
    total_value_uvr: Number(raw.total_value_uvr ?? 0),
    average_irr_fija: Number(raw.average_irr_fija ?? 0),
    average_irr_ibr: Number(raw.average_irr_ibr ?? 0),
    average_irr_uvr: Number(raw.average_irr_uvr ?? 0),
    outdated_loan_count: Number(raw.outdated_loan_count ?? 0),
    not_calculated_loan_count: Number(raw.not_calculated_loan_count ?? 0),
  };
};

export const fetchBulkLoanSummary = async (
  loanIds: string[],
  filterDate: string,
  opts?: FetchBulkLoanSummaryOptions,
): Promise<BulkLoanSummaryResponse> => {
  const response: BulkLoanSummaryResponse = { data: [], error: undefined };
  if (loanIds.length === 0) return response;

  const signal = combineAbortSignals(
    opts?.signal,
    opts?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );

  return telemetry.time(
    'loans',
    RPC_KEY,
    async () => {
      try {
        const { data, error } = await supabase
          .schema(SCHEMA)
          .rpc(RPC_KEY, { filter_date: filterDate, loans: loanIds })
          .abortSignal(signal);

        if (error) {
          telemetry.warn('loans', `${RPC_KEY} rpc error`, {
            count: loanIds.length,
            rpcMessage: error.message,
            code: error.code,
          });
          response.error = error.message ?? 'Bulk loan summary failed';
          return response;
        }

        const rows = Array.isArray(data) ? data : [];
        response.data = rows
          .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
          .map(normalizeRow);
        return response;
      } catch (e) {
        if (isAbortError(e)) throw e;
        telemetry.warn('loans', `${RPC_KEY} threw`, {
          count: loanIds.length,
          message: e instanceof Error ? e.message : String(e),
        });
        response.error = 'Bulk loan summary failed';
        return response;
      }
    },
    { count: loanIds.length, filterDate },
  );
};
