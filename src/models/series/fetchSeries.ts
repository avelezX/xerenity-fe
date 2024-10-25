import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieEntry } from 'src/types/lightserie';

// CashFlows Response
export type FullSeriesResponse = {
  data: LightSerieEntry[];
  error: string | undefined;
};

const ERRO_MSG = 'Error al cargar las series';
const SCHEMA = 'xerenity';
const TABLE_NAME = 'search_mv';
const supabase = createClientComponentClient();

export type SearchFilters = {
  grupo?: string;
  subGrupo?: string;
};

export const fetchFilterSeries = async ({
  grupo,
  subGrupo,
}: SearchFilters): Promise<FullSeriesResponse> => {
  const response: FullSeriesResponse = {
    data: [],
    error: undefined,
  };

  try {
    let query = supabase.schema(SCHEMA).from(TABLE_NAME).select();

    if (grupo) {
      query = query.eq('grupo', grupo);
    }
    if (subGrupo) {
      query = query.eq('sub_grupo', subGrupo);
    }

    const { data, error } = await query;

    if (error) {
      response.error = ERRO_MSG;
      return response;
    }

    response.data = data as LightSerieEntry[];
    return response;
  } catch (e) {
    response.error = ERRO_MSG;
    return response;
  }
};
