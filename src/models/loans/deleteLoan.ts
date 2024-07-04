import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export type DeleteLoanResponse = {
  data:
    | {
        message: string;
      }
    | undefined;
  error: string | undefined;
};

const DELETE_LOAN = {
  key: 'erase_loan',
  error: 'Error Deleting Loan',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

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
