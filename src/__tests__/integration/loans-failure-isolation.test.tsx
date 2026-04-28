/**
 * Integration test for `useLoanPortfolioSummary` (#316) covering the
 * "68 créditos nunca cargan" bug from #294.
 *
 * Sub-issue #327. Asserts that when one out of many per-loan queries
 * fails, the rest still resolve and surface in the aggregated result —
 * with `progress.failed` and `failedLoanIds` populated for the UI's
 * "Reintentar fallidos" button.
 *
 * Supabase JS doesn't go through `fetch()` (uses its own gotrue/postgrest
 * clients), so MSW can't intercept it. We mock `fetchCashFlows` directly
 * via `vi.mock`.
 */
import { vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { Loan } from 'src/types/loans';
import { fetchCashFlows } from 'src/models/loans/fetchCashFlows';
import { useLoanPortfolioSummary } from 'src/queries/loans';
import { renderHookWithClient } from '../mocks/test-helpers';

vi.mock('src/models/loans/fetchCashFlows', () => ({
  fetchCashFlows: vi.fn(),
}));

// The bulk RPC isn't relevant to these failure-isolation tests, but the hook
// chain calls it. Stub with a permanent reject so it doesn't make real
// network calls; the FE-computed fallback in `useLoanPortfolioSummary` then
// drives the assertions below.
vi.mock('src/models/loans/fetchBulkSummary', () => ({
  fetchBulkLoanSummary: vi.fn().mockResolvedValue({
    data: [],
    error: 'mocked-out',
  }),
}));

const mockedFetch = fetchCashFlows as unknown as ReturnType<typeof vi.fn>;

const mkLoan = (id: string, type = 'ibr', bank = 'Bancolombia'): Loan => ({
  id,
  start_date: '2024-01-01',
  number_of_payments: 12,
  original_balance: 1_000_000,
  rate_type: 0,
  periodicity: 'Mensual',
  interest_rate: 10,
  type,
  bank,
  grace_type: '',
  grace_period: '',
  min_period_rate: 0,
  days_count: '360',
  loan_identifier: id,
});

const mkFlow = (date: string, ending = 800_000) => ({
  date,
  beginning_balance: 1_000_000,
  payment: 100_000,
  interest: 10_000,
  principal: 90_000,
  ending_balance: ending,
  rate: 0.1,
  rate_tot: 0.1,
});

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('useLoanPortfolioSummary — failure isolation (#316)', () => {
  it('one loan rpc fails → other loans still display + progress.failed=1', async () => {
    const loans = [mkLoan('a'), mkLoan('b'), mkLoan('c')];

    mockedFetch.mockImplementation(async (loanId: string) => {
      if (loanId === 'b') {
        // Simulate the supabase wrapper's normal failure path: rpc
        // returns response.error set, no throw.
        return { data: [], error: 'rpc timed out' };
      }
      return { data: [mkFlow('2025-06-01 00:00:00')], error: undefined };
    });

    const { result } = renderHookWithClient(
      () => useLoanPortfolioSummary(loans, '2025-06-01'),
    );

    await waitFor(() => expect(result.current.isCalculating).toBe(false), { timeout: 3000 });

    // 2 succeeded, 1 failed
    expect(result.current.cashFlows.length).toBe(2);
    expect(result.current.cashFlows.map((c) => c.loanId).sort()).toEqual(['a', 'c']);
    expect(result.current.progress.failed).toBe(1);
    expect(result.current.progress.failedLoanIds).toEqual(['b']);
  });

  it('all loans succeed → progress.failed=0, fullLoan computed', async () => {
    const loans = [mkLoan('a'), mkLoan('b')];
    mockedFetch.mockResolvedValue({ data: [mkFlow('2025-06-01 00:00:00')], error: undefined });

    const { result } = renderHookWithClient(
      () => useLoanPortfolioSummary(loans, '2025-06-01'),
    );

    await waitFor(() => expect(result.current.isCalculating).toBe(false), { timeout: 3000 });

    expect(result.current.progress.failed).toBe(0);
    expect(result.current.cashFlows.length).toBe(2);
    expect(result.current.fullLoan).toBeDefined();
  });

  it('empty selection → no fetches, no progress activity', async () => {
    const { result } = renderHookWithClient(
      () => useLoanPortfolioSummary([], '2025-06-01'),
    );

    await waitFor(() => expect(result.current.isCalculating).toBe(false));

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(result.current.cashFlows.length).toBe(0);
    expect(result.current.progress.total).toBe(0);
    expect(result.current.fullLoan).toBeUndefined();
  });
});
