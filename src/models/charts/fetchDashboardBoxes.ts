// xerenity.read_banrep_serie(serie_id TEXT,col TEXT)

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieValue } from 'src/types/lightserie';

export type DashboardBox = {
  name: string;
  box_name: string;
  data: LightSerieValue;
};

export type FetchDashboardBoxesResponse = {
  data: DashboardBox[] | undefined;
  error: string | undefined;
};

const USDCOP = {
  rpc_name: 'dashboard_boxes',
  error: 'Error leyendo SerieBanrep',
};

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fectchDashboardBoxes =
  async (): Promise<FetchDashboardBoxesResponse> => {
    const response: FetchDashboardBoxesResponse = {
      data: undefined,
      error: undefined,
    };
    try {
      const { data, error } = await supabase
        .schema(SCHEMA)
        .rpc(USDCOP.rpc_name);
      if (error) {
        response.error = USDCOP.error;
        return response;
      }
      response.data = data as DashboardBox[];
      return response;
    } catch (e) {
      response.error = USDCOP.error;
      return response;
    }
  };
