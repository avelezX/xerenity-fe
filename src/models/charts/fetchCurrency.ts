import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TesYields } from 'src/types/tes';

export type FetchCurrencyResponse = {
  data: TesYields[] | undefined;
  error: string | undefined;
};

const USDCOP = {
  key: 'currency_exchange',
  error: 'Error leyendo USD:COP',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fetchCurrency = async (
  currency: string
): Promise<FetchCurrencyResponse> => {
  const response: FetchCurrencyResponse = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(USDCOP.key, { currency_name: currency });
    if (error) {
      response.error = USDCOP.error;
      return response;
    }
    response.data = data as TesYields[];
    return response;
  } catch (e) {
    response.error = USDCOP.error;
    return response;
  }
};
