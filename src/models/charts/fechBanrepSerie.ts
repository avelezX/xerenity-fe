// xerenity.read_banrep_serie(serie_id TEXT,col TEXT)

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieValue } from 'src/types/lightserie';

export type FetchBanrepSerieResponse = {
  data: LightSerieValue[] | undefined;
  error: string | undefined;
};

const USDCOP = {
  rpc_name: 'read_banrep_serie',
  error: 'Error leyendo SerieBanrep',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fetchBanrepSerie = async (
  serie: number
): Promise<FetchBanrepSerieResponse> => {
  const response: FetchBanrepSerieResponse = {
    data: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(USDCOP.rpc_name, { serie_id: serie, col: 'valor' });
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
