import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieValue } from 'src/types/lightserie';

export type FetchCPIIndexResponse = {
  data: LightSerieValue[] | undefined;
  error: string | undefined;
};

const USDCOP = {
  rpc_name: 'cpi_index_change',
  error: 'Error leyendo USD:COP',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fetchCpiIndex = async (
  id_canasta_search: number,
  lag_value: number
): Promise<FetchCPIIndexResponse> => {
  const response: FetchCPIIndexResponse = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(USDCOP.rpc_name, { id_canasta_search, lag_value });
    if (error) {
      response.error = USDCOP.error;
      return response;
    }
    response.data = data as LightSerieValue[];
    return response;
  } catch (e) {
    response.error = USDCOP.error;
    return response;
  }
};
