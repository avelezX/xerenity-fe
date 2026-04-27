/**
 * TanStack Query hooks for loan cashflows + portfolio summary aggregation.
 *
 * Phase 2 (#299) sub-issue #316 — replaces `setSelectedLoans` from
 * `src/store/loans/index.ts`. The store version manually managed batches of 5,
 * tokens, AbortController, retry, and progress; TanStack regala todo eso
 * gratis con `useQueries`:
 *
 * - **Per-loan caching**: every loanId+filterDate pair has its own cache
 *   entry. Re-selecting an already-fetched loan is instant.
 * - **Automatic dedupe**: two components asking for the same loan share the
 *   single in-flight request.
 * - **Independent failure**: one loan failing/aborting does not affect the
 *   others (drop-in replacement for `Promise.allSettled` from #294).
 * - **AbortSignal**: changing selection cancels in-flight queries the user
 *   no longer cares about.
 * - **`staleTime: 5 min`**: same loan/filterDate during navigation does not
 *   re-fetch.
 *
 * The aggregation (weighted IRR, tenor, duration per bank + global) is the
 * `buildPortfolioSummary` helper, lifted verbatim from the old store. It is a
 * pure function over the array of `CashFlowItem`s, so it works identically
 * here — the only difference is **when** it runs (a `useMemo` inside the
 * compound hook vs. inline at the end of the store action).
 */
import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  Loan,
  LoanCashFlowIbr,
  CashFlowItem,
  LoanData,
} from 'src/types/loans';
import { LightSerieValue } from 'src/types/lightserie';
import { fetchCashFlows } from 'src/models/loans/fetchCashFlows';
import { telemetry } from 'src/lib/telemetry';

export const loanKeys = {
  cashflow: (loanId: string, type: string, filterDate: string) =>
    ['loans', 'cashflow', loanId, type, filterDate] as const,
  cashflowAll: ['loans', 'cashflow'] as const,
};

const STALE_MS = 5 * 60_000;

/**
 * Pure helper — same logic that lived in `src/store/loans/index.ts` until
 * #316. Aggregates per-loan cashflows into per-bank + global LoanData rows
 * using outstanding balance as weight for IRR/tenor/duration.
 *
 * NOTE: this duplicates pricing logic that should ultimately live in the
 * backend (see Fase 3 epic #300 — bulk loan portfolio summary endpoint).
 * Until that lands, the FE keeps doing the math here.
 */
export function buildPortfolioSummary(
  cashFlows: CashFlowItem[],
  loans: Loan[],
): { fullLoan: LoanData; loanDebtData: LoanData[] } {
  const today = new Date().toISOString().slice(0, 10);
  const periodYears: Record<string, number> = {
    Mensual: 1 / 12, Trimestral: 0.25, Semestral: 0.5, Anual: 1,
  };

  const bankAcc: Record<string, {
    totalValue: number; accrued: number;
    weightedRate: number; weightedTenor: number; weightedDuration: number;
    loanCount: number; loanIds: string[];
    tvFija: number; tvIbr: number; tvUvr: number;
    wrFija: number; wrIbr: number; wrUvr: number;
  }> = {};

  cashFlows.forEach((cf) => {
    if (cf.flows.length === 0) return;
    const loan = loans.find((l) => l.id === cf.loanId);
    if (!loan) return;

    const pastFlows = cf.flows.filter((f) => f.date.split(' ')[0] <= today);
    const outstanding = pastFlows.length > 0
      ? pastFlows[pastFlows.length - 1].ending_balance
      : cf.flows[0].beginning_balance;

    if (outstanding <= 0) return;

    const avgRate = cf.flows.reduce((s, f) => s + (f.rate_tot ?? 0), 0) / cf.flows.length;

    const remainingFlows = cf.flows.filter((f) => f.date.split(' ')[0] > today);
    const pY = periodYears[loan.periodicity] ?? 0.25;
    const remainingTenor = remainingFlows.length * pY;

    let durationSum = 0;
    remainingFlows.forEach((f, i) => {
      const t = (i + 1) * pY;
      durationSum += t * (f.payment ?? 0);
    });
    const totalPayments = remainingFlows.reduce((s, f) => s + (f.payment ?? 0), 0);
    const duration = totalPayments > 0 ? durationSum / totalPayments : remainingTenor;

    const bank = loan.bank || 'Unknown';
    if (!bankAcc[bank]) {
      bankAcc[bank] = {
        totalValue: 0, accrued: 0,
        weightedRate: 0, weightedTenor: 0, weightedDuration: 0,
        loanCount: 0, loanIds: [],
        tvFija: 0, tvIbr: 0, tvUvr: 0,
        wrFija: 0, wrIbr: 0, wrUvr: 0,
      };
    }

    const b = bankAcc[bank];
    b.totalValue += outstanding;
    b.weightedRate += avgRate * outstanding;
    b.weightedTenor += remainingTenor * outstanding;
    b.weightedDuration += duration * outstanding;
    b.loanCount += 1;
    b.loanIds.push(loan.id);

    if (loan.type === 'fija') {
      b.tvFija += outstanding;
      b.wrFija += avgRate * outstanding;
    } else if (loan.type === 'ibr') {
      b.tvIbr += outstanding;
      b.wrIbr += avgRate * outstanding;
    } else if (loan.type === 'uvr') {
      b.tvUvr += outstanding;
      b.wrUvr += avgRate * outstanding;
    }
  });

  const loanDebtData: LoanData[] = [];
  let gtv = 0; let gac = 0; let gwr = 0; let gwt = 0; let gwd = 0; let glc = 0;
  let gtvF = 0; let gtvI = 0; let gtvU = 0; let gwrF = 0; let gwrI = 0; let gwrU = 0;

  Object.entries(bankAcc).forEach(([bank, b]) => {
    const tv = b.totalValue;
    loanDebtData.push({
      bank,
      loan_ids: b.loanIds,
      loan_count: b.loanCount,
      total_value: tv,
      accrued_interest: b.accrued,
      average_irr: tv > 0 ? b.weightedRate / tv / 100 : 0,
      average_tenor: tv > 0 ? b.weightedTenor / tv : 0,
      average_duration: tv > 0 ? b.weightedDuration / tv : 0,
      total_value_fija: b.tvFija,
      total_value_ibr: b.tvIbr,
      total_value_uvr: b.tvUvr,
      average_irr_fija: b.tvFija > 0 ? b.wrFija / b.tvFija / 100 : 0,
      average_irr_ibr: b.tvIbr > 0 ? b.wrIbr / b.tvIbr / 100 : 0,
      average_irr_uvr: b.tvUvr > 0 ? b.wrUvr / b.tvUvr / 100 : 0,
      outdated_loan_count: 0,
      not_calculated_loan_count: 0,
    });
    gtv += tv; gac += b.accrued; gwr += b.weightedRate;
    gwt += b.weightedTenor; gwd += b.weightedDuration; glc += b.loanCount;
    gtvF += b.tvFija; gtvI += b.tvIbr; gtvU += b.tvUvr;
    gwrF += b.wrFija; gwrI += b.wrIbr; gwrU += b.wrUvr;
  });

  loanDebtData.sort((a, b) => b.total_value - a.total_value);

  const fullLoan: LoanData = {
    bank: '0',
    loan_ids: [],
    loan_count: glc,
    total_value: gtv,
    accrued_interest: gac,
    average_irr: gtv > 0 ? gwr / gtv / 100 : 0,
    average_tenor: gtv > 0 ? gwt / gtv : 0,
    average_duration: gtv > 0 ? gwd / gtv : 0,
    total_value_fija: gtvF,
    total_value_ibr: gtvI,
    total_value_uvr: gtvU,
    average_irr_fija: gtvF > 0 ? gwrF / gtvF / 100 : 0,
    average_irr_ibr: gtvI > 0 ? gwrI / gtvI / 100 : 0,
    average_irr_uvr: gtvU > 0 ? gwrU / gtvU / 100 : 0,
    outdated_loan_count: 0,
    not_calculated_loan_count: 0,
  };

  return { fullLoan, loanDebtData };
}

/** Merge per-loan cashflows into a single date-keyed series (for the
 *  consolidated chart at the top of the loans page). */
function mergeCashflowsByDate(cashFlows: CashFlowItem[]): LoanCashFlowIbr[] {
  const byDate: Record<string, LoanCashFlowIbr> = {};
  cashFlows.forEach((item) => {
    item.flows.forEach((flow) => {
      const existing = byDate[flow.date];
      if (existing) {
        byDate[flow.date] = {
          principal: existing.principal + flow.principal,
          rate: existing.rate,
          date: flow.date,
          beginning_balance: existing.beginning_balance + flow.beginning_balance,
          payment: existing.payment + flow.payment,
          interest: existing.interest + flow.interest,
          ending_balance: existing.ending_balance + flow.ending_balance,
          rate_tot: existing.rate_tot,
        };
      } else {
        byDate[flow.date] = { ...flow };
      }
    });
  });
  return Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface LoanCalcProgress {
  total: number;
  completed: number;
  calculating: boolean;
  failed: number;
  failedLoanIds: string[];
}

export interface UseLoanPortfolioSummaryResult {
  cashFlows: CashFlowItem[];
  mergedCashFlows: LoanCashFlowIbr[];
  fullLoan: LoanData | undefined;
  loanDebtData: LoanData[];
  chartData: LightSerieValue[];
  progress: LoanCalcProgress;
  /** True while any of the per-loan queries is loading. Equivalent to the
   *  store's `calculationProgress.calculating` flag. */
  isCalculating: boolean;
  /** Triggers refetch on every loan that ended in error/abort. Replaces the
   *  old `retryFailedLoans` action. */
  retryFailed: () => void;
}

/**
 * Compound hook: fans out N per-loan queries via `useQueries`, then derives
 * the merged series + portfolio summary + progress from their results.
 */
export function useLoanPortfolioSummary(
  selectedLoans: Loan[],
  filterDate: string,
): UseLoanPortfolioSummaryResult {
  const queryClient = useQueryClient();

  const queries = useQueries({
    queries: selectedLoans.map((loan) => ({
      queryKey: loanKeys.cashflow(loan.id, loan.type, filterDate),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchCashFlows(loan.id, loan.type, filterDate, { signal }),
      staleTime: STALE_MS,
      retry: 0 as const,
    })),
  });

  return useMemo(() => {
    const cashFlows: CashFlowItem[] = [];
    const failedLoanIds: string[] = [];
    let completed = 0;
    let calculating = false;

    queries.forEach((q, i) => {
      const loan = selectedLoans[i];
      if (q.isLoading || q.isFetching) {
        calculating = true;
        return;
      }
      // Query settled (success or hard error).
      completed += 1;
      if (q.error) {
        // Hard error from fetcher itself (e.g. AbortError, network); ignore
        // aborts but track real failures.
        const reason = q.error instanceof Error ? q.error.message : String(q.error);
        if (!reason.toLowerCase().includes('abort')) failedLoanIds.push(loan.id);
        return;
      }
      const { data } = q;
      if (!data || data.error) {
        if (data?.error) failedLoanIds.push(loan.id);
        return;
      }
      cashFlows.push({ loanId: loan.id, flows: data.data });
    });

    const mergedCashFlows = mergeCashflowsByDate(cashFlows);
    const chartData: LightSerieValue[] = mergedCashFlows.map((v) => ({
      time: v.date.split(' ')[0],
      value: v.payment,
    }));
    const { fullLoan, loanDebtData } = buildPortfolioSummary(cashFlows, selectedLoans);

    const progress: LoanCalcProgress = {
      total: selectedLoans.length,
      completed,
      calculating,
      failed: failedLoanIds.length,
      failedLoanIds,
    };

    const retryFailed = () => {
      if (failedLoanIds.length === 0) return;
      telemetry.info('loans', 'retrying failed loans', {
        count: failedLoanIds.length, ids: failedLoanIds,
      });
      failedLoanIds.forEach((id) => {
        const loan = selectedLoans.find((l) => l.id === id);
        if (!loan) return;
        queryClient.invalidateQueries({
          queryKey: loanKeys.cashflow(loan.id, loan.type, filterDate),
        });
      });
    };

    return {
      cashFlows,
      mergedCashFlows,
      fullLoan: selectedLoans.length === 0 ? undefined : fullLoan,
      loanDebtData,
      chartData,
      progress,
      isCalculating: calculating,
      retryFailed,
    };
    // queries is recomputed by useQueries on every render; including it as a
    // dep correctly triggers re-aggregation when any query state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries, selectedLoans, filterDate]);
}
