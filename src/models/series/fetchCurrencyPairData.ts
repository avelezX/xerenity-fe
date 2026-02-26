import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieValue } from 'src/types/lightserie';

const SCHEMA = 'xerenity';
const RPC_NAME = 'get_currency';

const supabase = createClientComponentClient();

export type CurrencyPairResponse = {
  data: LightSerieValue[] | undefined;
  error: string | undefined;
};

export const fetchCurrencyPairData = async (
  pair: string
): Promise<CurrencyPairResponse> => {
  const response: CurrencyPairResponse = {
    data: undefined,
    error: undefined,
  };

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(RPC_NAME, { currency_name: pair });

    if (error) {
      response.error = error.message;
    } else if (data) {
      response.data = data as LightSerieValue[];
    }
    return response;
  } catch (e) {
    response.error = 'Error al cargar par de monedas';
    return response;
  }
};
