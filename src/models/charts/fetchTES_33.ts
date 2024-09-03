import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TesYields } from 'src/types/tes';

export type FetchTES33Response = {
  data: TesYields[] | undefined;
  error: string | undefined;
};

const FETCH_TES_33 = {
  key: 'tes_33',
  error: 'Error Creating Loan',
};

const supabase = createClientComponentClient();
const SCHEMA = 'public';

export const fetchTES33 = async (): Promise<FetchTES33Response> => {
  const response: FetchTES33Response = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(FETCH_TES_33.key);
    if (error) {
      response.error = FETCH_TES_33.error;
      return response;
    }
    response.data = data;
    return response;
  } catch (e) {
    response.error = FETCH_TES_33.error;
    return response;
  }
};
