import { fetchLoans, LoanResponse } from './fetchLoans';
import { fetchBanks, BankResponse } from './fetchBanks';
import { fetchCashFlows, CashflowResponse } from './fetchCashFlows';
import { deleteLoan, DeleteLoanResponse } from './deleteLoan';

export type {
  LoanResponse,
  BankResponse,
  CashflowResponse,
  DeleteLoanResponse,
};

export { fetchLoans, fetchBanks, fetchCashFlows, deleteLoan };
