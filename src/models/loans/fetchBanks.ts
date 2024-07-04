import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bank } from 'src/types/loans';

// Bank Response Type
export type BankResponse = {
  data: Bank[];
  error: string | undefined;
};

const BANKS = {
  key: 'get_banks',
  error: 'Error Fetching Banks',
};

const SCHEMA = 'xerenity';
const supabase = createClientComponentClient();

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
