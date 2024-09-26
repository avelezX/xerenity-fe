export interface Loan {
  id: string;
  start_date: string;
  number_of_payments: number;
  original_balance: number;
  rate_type: number;
  periodicity: string;
  interest_rate: number;
  type: string;
  bank: string;
  grace_type: string;
  grace_period: string;
  min_period_rate: number;
  days_count: string;
  loan_identifier: string;
}

export interface LoanData {
  bank: string;
  loan_ids: string[];
  loan_count: number;
  average_irr: number;
  total_value: number;
  average_tenor: number;
  average_irr_ibr: number;
  total_value_ibr: number;
  accrued_interest: number;
  average_duration: number;
  average_irr_fija: number;
  total_value_fija: number;
  outdated_loan_count: number;
  not_calculated_loan_count: number;
}

export interface LoanCashFlow {
  date: string;
  beginning_balance: number;
  payment: number;
  interest: number;
  principal: number;
  ending_balance: number;
}

export interface LoanCashFlowIbr extends LoanCashFlow {
  rate: number;
  rate_tot: number;
}

export interface LoanType {
  value: string;
  display: string;
}

export interface Bank {
  bank_name: string;
}

export type CashFlowItem = {
  loanId: string;
  flows: LoanCashFlowIbr[];
};

export type NewLoanValues = Omit<Loan, 'id'>;
