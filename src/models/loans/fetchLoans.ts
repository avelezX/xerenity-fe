import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bank, Loan } from 'src/types/loans';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type LoanResponse = {
  data: Loan[];
  error: string | undefined;
};

const LOANS = {
  key: 'get_loans',
  error: 'Error Fetching Loans',
};

export const fetchLoans = async (banks: Bank[], companyId?: string): Promise<LoanResponse> => {
  const response: LoanResponse = {
    data: [],
    error: undefined,
  };
  try {
    const params: Record<string, unknown> = {
      bank_name_filter: banks.map((bck) => bck.bank_name),
    };
    if (companyId) params.p_company_id = companyId;

    const { data, error } = await supabase.schema(SCHEMA).rpc(LOANS.key, params);

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
