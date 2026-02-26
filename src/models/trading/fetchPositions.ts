import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
} from 'src/types/trading';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type PositionsResponse<T> = {
  data: T[];
  error: string | undefined;
};

export const fetchXccyPositions = async (): Promise<
  PositionsResponse<XccyPosition>
> => {
  const response: PositionsResponse<XccyPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_xccy_positions');
    if (error) {
      response.error = 'Error fetching XCCY positions';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching XCCY positions';
    return response;
  }
};

export const fetchNdfPositions = async (): Promise<
  PositionsResponse<NdfPosition>
> => {
  const response: PositionsResponse<NdfPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_ndf_positions');
    if (error) {
      response.error = 'Error fetching NDF positions';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching NDF positions';
    return response;
  }
};

export const fetchIbrSwapPositions = async (): Promise<
  PositionsResponse<IbrSwapPosition>
> => {
  const response: PositionsResponse<IbrSwapPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_ibr_swap_positions');
    if (error) {
      response.error = 'Error fetching IBR Swap positions';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching IBR Swap positions';
    return response;
  }
};
