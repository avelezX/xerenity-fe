import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LoanCashFlowIbr } from 'src/types/loans';

// CashFlows Response
export type CashflowResponse = {
  data: LoanCashFlowIbr[];
  error: string | undefined;
};

const CASH_FLOW = {
  key: 'loan_cash_flow',
  error: 'Error Fetching Cash Flows',
};

const CASH_FLOW_IBR = {
  key: 'ibr_cash_flow',
  error: 'Error Fetching IBR Cash Flows',
};

const CASH_FLOW_UVR = {
  key: 'uvr_cash_flow',
  error: 'Error Fetching UVR Cash Flows',
};

const SCHEMA = 'xerenity';
const supabase = createClientComponentClient();

export const fetchCashFlows = async (
  loanId: string,
  loanType: string,
  filterDate: string
): Promise<CashflowResponse> => {
  let requestKey = CASH_FLOW.key;

  if (loanType === 'ibr') {
    requestKey = CASH_FLOW_IBR.key;
  } else if (loanType === 'uvr') {
    requestKey = CASH_FLOW_UVR.key;
  }
  const response: CashflowResponse = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(requestKey, { credito_id: loanId, filter_date: filterDate });

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
