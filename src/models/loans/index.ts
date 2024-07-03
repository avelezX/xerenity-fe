import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bank } from 'src/types/loans';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

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

export const fetchSupaBanks = async () => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(BANKS.key);

    if (error) {
      return { error: BANKS.error };
    }
    return { data };
  } catch (e) {
    return { error: e };
  }
};

export const fetchSupaLoans = async (banks: Bank[]) => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(LOANS.key, {
      bank_name_filter: banks.map((bck) => bck.bank_name),
    });

    if (error) {
      return { error: LOANS.error };
    }

    return { data };
  } catch (e) {
    return { error: e };
  }
};

export const calculateCashFlow = async (loanId: string, loanType: string) => {
  const requestKey = loanType === 'fija' ? CASH_FLOW.key : CASH_FLOW_IBR.key;

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(requestKey, { credito_id: loanId });
    if (error) {
      return { error: LOANS.error };
    }

    return { data };
  } catch (e) {
    return { error: e };
  }
};

export const deleteLoan = async (loanId: string) => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(DELETE_LOAN.key, { credito_id: loanId });
    if (error) {
      return { error: DELETE_LOAN.error };
    }

    return { data };
  } catch (e) {
    return { error: e };
  }
};
