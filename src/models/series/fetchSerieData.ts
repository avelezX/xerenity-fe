import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerie, LightSerieValue } from 'src/types/lightserie';

// CashFlows Response
export type SerieDataResponse = {
  data: LightSerie | undefined;
  error: string | undefined;
};

const ERRO_MSG = 'Error al cargar las series';
const SCHEMA = 'xerenity';
const RPC_NAME = 'search';
const supabase = createClientComponentClient();

type GetSeriesDataProps = {
  idSerie: string;
  newColor: string;
};

export const fetchSeriesData = async ({
  idSerie,
  newColor,
}: GetSeriesDataProps): Promise<SerieDataResponse> => {
  const response: SerieDataResponse = {
    data: undefined,
    error: undefined,
  };

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(RPC_NAME, { ticket: idSerie });

    if (error) {
      response.error = error.message;
    } else {
      response.data = {
        serie: data.data as LightSerieValue[],
        color: newColor,
        name: '',
      } as LightSerie;
    }
    return response;
  } catch (e) {
    response.error = ERRO_MSG;
    return response;
  }
};
