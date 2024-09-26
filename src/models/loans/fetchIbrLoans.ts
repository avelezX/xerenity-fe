import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LoanData } from 'src/types/loans';

// CashFlows Response
export type FullLoanResponse = {
  data: LoanData[];
  error: string | undefined;
};

const CASH_FLOW = {
  key: 'loan_cash_flow',
  error: 'Error Fetching Cash Flows',
};

const CASH_FLOW_IBR = {
  key: 'ibr_cash_flow_by_loans',
  error: 'Error Fetching IBR Cash Flows',
};

const SCHEMA = 'xerenity';
const supabase = createClientComponentClient();

export const fetchLoansIbrs = async (
  loanIds: string[],
  filterDate: string
): Promise<FullLoanResponse> => {
  const response: FullLoanResponse = {
    data: [],
    error: undefined,
  };

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(CASH_FLOW_IBR.key, { loans: loanIds, filter_date: filterDate });

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
