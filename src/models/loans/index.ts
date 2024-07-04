import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bank, Loan, LoanCashFlowIbr } from 'src/types/loans';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

// TODO: Move this type to /types folder
export type LoanResponse = {
  data: Loan[];
  error: string | undefined;
};

// Bank Response Type
export type BankResponse = {
  data: Bank[];
  error: string | undefined;
};

// CashFlows Response
export type CashflowResponse = {
  data: LoanCashFlowIbr[];
  error: string | undefined;
};

export type DeleteLoanResponse = {
  data:
    | {
        message: string;
      }
    | undefined;
  error: string | undefined;
};

const BANKS = {
  key: 'get_banks',
  error: 'Error Fetching Banks',
};

const LOANS = {
  key: 'get_loans',
  error: 'Error Fetching Loans',
};

const CASH_FLOW = {
  key: 'loan_cash_flow',
  error: 'Error Fetching Cash Flows',
};

const CASH_FLOW_IBR = {
  key: 'ibr_cash_flow',
  error: 'Error Fetching IBR Cash Flows',
};

const DELETE_LOAN = {
  key: 'erase_loan',
  error: 'Error Deleting Loan',
};

export const fetchBanks = async (): Promise<BankResponse> => {
  const response: BankResponse = {
    data: [],
    error: undefined,
  };

  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(BANKS.key);

    if (error) {
      response.error = BANKS.error;
      return response;
    }

    response.data = data;
    return response;
  } catch (e) {
    response.error = BANKS.error;
    return response;
  }
};

export const fetchLoans = async (banks: Bank[]): Promise<LoanResponse> => {
  const response: LoanResponse = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(LOANS.key, {
      bank_name_filter: banks.map((bck) => bck.bank_name),
    });

    if (error) {
      response.error = LOANS.error;
      return response;
    }
    response.data = data;
    return response;
  } catch (e) {
    response.error = LOANS.error;
    return response;
  }
};

export const calculateCashFlow = async (
  loanId: string,
  loanType: string
): Promise<CashflowResponse> => {
  const requestKey = loanType === 'fija' ? CASH_FLOW.key : CASH_FLOW_IBR.key;
  const response: CashflowResponse = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(requestKey, { credito_id: loanId });

    if (error) {
      response.error = CASH_FLOW.error;
      return response;
    }

    response.data = data;
    return response;
  } catch (e) {
    response.error = CASH_FLOW.error;
    return response;
  }
};

export const deleteLoan = async (
  loanId: string
): Promise<DeleteLoanResponse> => {
  const response: DeleteLoanResponse = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(DELETE_LOAN.key, { credito_id: loanId });
    if (error) {
      response.error = DELETE_LOAN.error;
      return response;
    }
    response.data = data;
    return response;
  } catch (e) {
    response.error = DELETE_LOAN.error;
    return response;
  }
};
