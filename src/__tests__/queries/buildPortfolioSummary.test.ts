/**
 * Property-based tests for `buildPortfolioSummary` from `src/queries/loans.ts`.
 *
 * Sub-issue #326. The function aggregates per-loan cashflows into per-bank
 * + global LoanData rows using outstanding balance as weight for IRR/tenor/
 * duration. It has math invariants that fast-check can verify by generating
 * 100+ random portfolios and checking properties hold.
 *
 * If any of these tests fails, somebody changed the aggregation logic in a
 * way that broke conservation of value or introduced NaN. Either fix the
 * regression or update the invariant intentionally.
 */
import * as fc from 'fast-check';
import { buildPortfolioSummary } from 'src/queries/loans';
import { portfolioArb } from '../fixtures/loans';

describe('buildPortfolioSummary — property-based', () => {
  it('total_value of fullLoan equals sum of bank totals', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 1, max: 15 }), ({ loans, cashFlows }) => {
        const { fullLoan, loanDebtData } = buildPortfolioSummary(cashFlows, loans);
        const sumOfBanks = loanDebtData.reduce((acc, b) => acc + b.total_value, 0);
        // Allow tiny floating-point drift.
        expect(Math.abs(fullLoan.total_value - sumOfBanks)).toBeLessThan(1e-6);
      }),
    );
  });

  it('loan_count of fullLoan equals sum of bank counts', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 0, max: 15 }), ({ loans, cashFlows }) => {
        const { fullLoan, loanDebtData } = buildPortfolioSummary(cashFlows, loans);
        const sumCounts = loanDebtData.reduce((acc, b) => acc + b.loan_count, 0);
        expect(fullLoan.loan_count).toBe(sumCounts);
      }),
    );
  });

  it('never produces NaN or Infinity in any aggregate', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 0, max: 15 }), ({ loans, cashFlows }) => {
        const { fullLoan, loanDebtData } = buildPortfolioSummary(cashFlows, loans);
        const numericFields: (keyof typeof fullLoan)[] = [
          'total_value', 'average_irr', 'average_tenor', 'average_duration',
          'total_value_fija', 'total_value_ibr', 'total_value_uvr',
          'average_irr_fija', 'average_irr_ibr', 'average_irr_uvr',
          'accrued_interest',
        ];
        numericFields.forEach((f) => {
          expect(Number.isFinite(fullLoan[f] as number)).toBe(true);
        });
        loanDebtData.forEach((bank) => {
          numericFields.forEach((f) => {
            expect(Number.isFinite(bank[f] as number)).toBe(true);
          });
        });
      }),
    );
  });

  it('empty input → empty output (no crashes)', () => {
    const { fullLoan, loanDebtData } = buildPortfolioSummary([], []);
    expect(loanDebtData).toEqual([]);
    expect(fullLoan.total_value).toBe(0);
    expect(fullLoan.loan_count).toBe(0);
    expect(fullLoan.average_irr).toBe(0);
  });

  it('two loans from same bank → one row in loanDebtData', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 2, max: 2 }), ({ loans, cashFlows }) => {
        // Force same bank
        const sameBank = 'Bancolombia';
        const normalized = loans.map((l) => ({ ...l, bank: sameBank }));
        const { loanDebtData } = buildPortfolioSummary(cashFlows, normalized);
        // It's possible both loans had outstanding=0 and got skipped; in that
        // case loanDebtData is empty. Otherwise it must have exactly 1 row.
        expect(loanDebtData.length === 0 || loanDebtData.length === 1).toBe(true);
        if (loanDebtData.length === 1) {
          expect(loanDebtData[0].bank).toBe(sameBank);
        }
      }),
    );
  });

  it('total_value_{fija,ibr,uvr} sums to total_value per bank', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 1, max: 15 }), ({ loans, cashFlows }) => {
        const { loanDebtData } = buildPortfolioSummary(cashFlows, loans);
        loanDebtData.forEach((bank) => {
          const splitSum = bank.total_value_fija + bank.total_value_ibr + bank.total_value_uvr;
          expect(Math.abs(bank.total_value - splitSum)).toBeLessThan(1e-6);
        });
      }),
    );
  });

  it('loanDebtData is sorted by total_value descending', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 2, max: 15 }), ({ loans, cashFlows }) => {
        const { loanDebtData } = buildPortfolioSummary(cashFlows, loans);
        for (let i = 1; i < loanDebtData.length; i += 1) {
          expect(loanDebtData[i - 1].total_value).toBeGreaterThanOrEqual(
            loanDebtData[i].total_value,
          );
        }
      }),
    );
  });

  it('does not mutate input arrays', () => {
    fc.assert(
      fc.property(portfolioArb({ min: 1, max: 5 }), ({ loans, cashFlows }) => {
        const loansCopy = JSON.parse(JSON.stringify(loans));
        const cashFlowsCopy = JSON.parse(JSON.stringify(cashFlows));
        buildPortfolioSummary(cashFlows, loans);
        expect(loans).toEqual(loansCopy);
        expect(cashFlows).toEqual(cashFlowsCopy);
      }),
    );
  });
});
