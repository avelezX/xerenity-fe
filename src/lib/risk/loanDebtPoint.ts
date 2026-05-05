/**
 * Compute where a loan sits on a yield-vs-tenor plane for the Créditos
 * debt-curve chart.
 *
 * - Tenor: years from today to the contractual maturity
 *   (start_date + number_of_payments × periodicity).
 * - Rate:
 *     - fija   → loan.interest_rate (already nominal annual %)
 *     - ibr    → IBR (matched to the loan's periodicity) + spread
 *     - uvr    → not supported in this iteration; returns null
 *
 * The spread for a Banco's pricing analysis (Cheapest Bank chart) is the
 * delta against the sovereign curve at the same tenor — see
 * `interpolateSovereignYield`.
 */
import { Loan } from 'src/types/loans';
import { IbrCurvePoint } from 'src/queries/sovereignCurve';

const PERIOD_YEARS: Record<string, number> = {
  Mensual: 1 / 12,
  Trimestral: 0.25,
  Semestral: 0.5,
  Anual: 1,
};

/** Default IBR tenor (in months) to use for each loan periodicity. */
const PERIODICITY_TO_IBR_MONTHS: Record<string, number> = {
  Mensual: 1,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

export type DebtPointType = 'fija' | 'ibr';

export interface LoanDebtPoint {
  loanId: string;
  identifier: string;
  bank: string;
  type: DebtPointType;
  tenorYears: number;
  /** Total nominal annual rate (%): fija = interest_rate; ibr = IBR + spread. */
  totalRate: number;
  /** IBR component (%) when type='ibr', else null. */
  baseRate: number | null;
  /** Spread (%) — for 'fija' equals totalRate; for 'ibr' equals interest_rate. */
  spread: number;
  /** Outstanding balance (or original_balance fallback). */
  amount: number;
  /** Display label of the IBR tenor used (e.g. "IBR 3M"). */
  baseLabel: string | null;
  /** ISO date of the maturity. */
  maturityDate: string;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function maturityDate(loan: Loan): Date | null {
  if (!loan.start_date) return null;
  const start = new Date(loan.start_date);
  if (Number.isNaN(start.getTime())) return null;
  const periodMonths = (PERIOD_YEARS[loan.periodicity] ?? 0) * 12;
  if (periodMonths <= 0) return null;
  return addMonths(start, Math.round(periodMonths * loan.number_of_payments));
}

/** Pick the IBR point closest to the loan's natural reset period. */
function pickIbrForLoan(
  periodicity: string,
  ibrCurve: IbrCurvePoint[],
): IbrCurvePoint | null {
  if (ibrCurve.length === 0) return null;
  const targetMonths = PERIODICITY_TO_IBR_MONTHS[periodicity] ?? 3;
  let best = ibrCurve[0];
  let bestDiff = Math.abs(best.tenorMonths - targetMonths);
  ibrCurve.forEach((p) => {
    const diff = Math.abs(p.tenorMonths - targetMonths);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  });
  return best;
}

export function getLoanDebtPoint(
  loan: Loan,
  ibrCurve: IbrCurvePoint[],
): LoanDebtPoint | null {
  if (loan.type !== 'fija' && loan.type !== 'ibr') return null;

  const maturity = maturityDate(loan);
  if (!maturity) return null;
  const tenorYears = (maturity.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000);
  if (tenorYears <= 0) return null;

  const identifier = loan.loan_identifier || loan.id.slice(0, 8);
  const amount = loan.original_balance ?? 0;

  if (loan.type === 'fija') {
    return {
      loanId: loan.id,
      identifier,
      bank: loan.bank || 'Sin banco',
      type: 'fija',
      tenorYears,
      totalRate: loan.interest_rate,
      baseRate: null,
      spread: loan.interest_rate,
      amount,
      baseLabel: null,
      maturityDate: maturity.toISOString().slice(0, 10),
    };
  }

  // ibr: needs an IBR reference
  const ibr = pickIbrForLoan(loan.periodicity, ibrCurve);
  if (!ibr) return null;

  return {
    loanId: loan.id,
    identifier,
    bank: loan.bank || 'Sin banco',
    type: 'ibr',
    tenorYears,
    totalRate: ibr.rate + loan.interest_rate,
    baseRate: ibr.rate,
    spread: loan.interest_rate,
    amount,
    baseLabel: ibr.displayname,
    maturityDate: maturity.toISOString().slice(0, 10),
  };
}
