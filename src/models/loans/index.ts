import { fetchLoans, LoanResponse } from './fetchLoans';
import { fetchBanks, BankResponse } from './fetchBanks';
import { fetchCashFlows, CashflowResponse } from './fetchCashFlows';
import { deleteLoan, DeleteLoanResponse } from './deleteLoan';
import { createNewLoan, CreateLoanResponse } from './createLoan';
import { fetchLoansIbrs } from './fetchIbrLoans';

export type {
  LoanResponse,
  BankResponse,
  CashflowResponse,
  DeleteLoanResponse,
  CreateLoanResponse,
};

export {
  fetchLoans,
  fetchBanks,
  fetchCashFlows,
  deleteLoan,
  createNewLoan,
  fetchLoansIbrs,
};
