import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { NewLoanValues } from 'src/types/loans';

export type CreateLoanResponse = {
  data:
    | {
        message: string;
      }
    | undefined;
  error: string | undefined;
};

const CREATE_LOAN = {
  key: 'create_credit',
  error: 'Error Creating Loan',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const createNewLoan = async (
  values: NewLoanValues
): Promise<CreateLoanResponse> => {
  const response: CreateLoanResponse = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(CREATE_LOAN.key, values);
    if (error) {
      response.error = CREATE_LOAN.error;
      return response;
    }
    response.data = data;
    return response;
  } catch (e) {
    response.error = CREATE_LOAN.error;
    return response;
  }
};
