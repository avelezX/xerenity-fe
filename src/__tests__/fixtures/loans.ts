/**
 * fast-check arbitraries for Loan + CashFlowItem fixtures.
 *
 * Sub-issue #326. The arbitraries are tuned to produce *plausible* loan data:
 * positive balances, dates in the recent past, valid types/periodicities, etc.
 * Property tests (`buildPortfolioSummary.test.ts`) consume these to verify
 * mathematical invariants over hundreds of generated portfolios.
 *
 * Why narrow the arbitrary domain:
 * - `fast-check` defaults generate the full numeric range, including
 *   negatives, NaN, Infinity. Real loan data is non-negative finite.
 * - Random strings would never match the `loan.type` discriminator that
 *   `buildPortfolioSummary` branches on (`'fija' | 'ibr' | 'uvr'`).
 */
import * as fc from 'fast-check';
import { Loan, CashFlowItem, LoanCashFlowIbr } from 'src/types/loans';

const LOAN_TYPES = ['fija', 'ibr', 'uvr'] as const;
const PERIODICITIES = ['Mensual', 'Trimestral', 'Semestral', 'Anual'] as const;
const BANKS = ['Bancolombia', 'Banco Agrario', 'Banco de Occidente', 'Banco Santander'] as const;

/** Generate a YYYY-MM-DD string within the last 5 years. */
const dateInRecentPast = (): fc.Arbitrary<string> =>
  fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2027-01-01'),
    noInvalidDate: true,
  }).map((d) => d.toISOString().slice(0, 10));

export const loanArb = (): fc.Arbitrary<Loan> =>
  fc.record({
    id: fc.uuid(),
    start_date: dateInRecentPast(),
    number_of_payments: fc.integer({ min: 1, max: 360 }),
    original_balance: fc.double({ min: 1000, max: 1e10, noNaN: true, noDefaultInfinity: true }),
    rate_type: fc.integer({ min: 0, max: 5 }),
    periodicity: fc.constantFrom(...PERIODICITIES),
    interest_rate: fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
    type: fc.constantFrom(...LOAN_TYPES),
    bank: fc.constantFrom(...BANKS),
    grace_type: fc.constant(''),
    grace_period: fc.constant(''),
    min_period_rate: fc.double({ min: 0, max: 0.1, noNaN: true, noDefaultInfinity: true }),
    days_count: fc.constant('360'),
    loan_identifier: fc.string({ minLength: 1, maxLength: 20 }),
  });

/** Build a valid amortizing cashflow series for a given balance. */
const cashflowSeriesArb = (
  loanId: string,
  balance: number,
  numPayments: number,
): fc.Arbitrary<LoanCashFlowIbr[]> => {
  const principalPerPayment = balance / numPayments;
  return fc.array(
    fc.record({
      // The actual date doesn't matter for buildPortfolioSummary's logic
      // (it only compares against `today`). Use ascending fake dates.
      date: fc.constant('2025-01-01 00:00:00'),
      payment: fc.double({ min: principalPerPayment, max: principalPerPayment * 2, noNaN: true, noDefaultInfinity: true }),
      interest: fc.double({ min: 0, max: principalPerPayment, noNaN: true, noDefaultInfinity: true }),
      principal: fc.constant(principalPerPayment),
      beginning_balance: fc.double({ min: 0, max: balance, noNaN: true, noDefaultInfinity: true }),
      ending_balance: fc.double({ min: 0, max: balance, noNaN: true, noDefaultInfinity: true }),
      rate: fc.double({ min: 0, max: 0.5, noNaN: true, noDefaultInfinity: true }),
      rate_tot: fc.double({ min: 0, max: 0.5, noNaN: true, noDefaultInfinity: true }),
    }),
    { minLength: 1, maxLength: numPayments },
  ).map((flows) => {
    // Make dates strictly ascending so the "past flows" filter has stable
    // semantics — flows[0] is oldest, last is newest.
    return flows.map((f, i) => ({
      ...f,
      date: `2025-${String((i % 12) + 1).padStart(2, '0')}-01 00:00:00`,
    }));
  });
};

export const cashflowItemArb = (loan: Loan): fc.Arbitrary<CashFlowItem> =>
  cashflowSeriesArb(loan.id, loan.original_balance, loan.number_of_payments).map(
    (flows) => ({ loanId: loan.id, flows }),
  );

/**
 * Compose: generate N loans + a cashflow item per loan. The arbitrary is
 * what most property tests will consume.
 */
export const portfolioArb = (
  loanCount: { min: number; max: number } = { min: 0, max: 20 },
): fc.Arbitrary<{ loans: Loan[]; cashFlows: CashFlowItem[] }> =>
  fc.array(loanArb(), { minLength: loanCount.min, maxLength: loanCount.max })
    .chain((loans) =>
      fc
        .tuple(...loans.map((l) => cashflowItemArb(l)))
        .map((cashFlows) => ({ loans, cashFlows: cashFlows as CashFlowItem[] })),
    );
