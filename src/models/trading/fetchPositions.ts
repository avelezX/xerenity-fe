import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  TesPosition,
  UserTradingRole,
} from 'src/types/trading';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fetchUserTradingRole = async (): Promise<UserTradingRole> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_user_trading_role');
    if (error || !data) return { role: null, company_id: null, company_name: null };
    return data as UserTradingRole;
  } catch {
    return { role: null, company_id: null, company_name: null };
  }
};

export type PositionsResponse<T> = {
  data: T[];
  error: string | undefined;
};

export const fetchXccyPositions = async (
  companyId?: string,
): Promise<PositionsResponse<XccyPosition>> => {
  const response: PositionsResponse<XccyPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const params: Record<string, unknown> = {};
    if (companyId) params.p_company_id = companyId;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_xccy_positions', params);
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

export const fetchNdfPositions = async (
  companyId?: string,
): Promise<PositionsResponse<NdfPosition>> => {
  const response: PositionsResponse<NdfPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const params: Record<string, unknown> = {};
    if (companyId) params.p_company_id = companyId;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_ndf_positions', params);
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

export const fetchIbrSwapPositions = async (
  companyId?: string,
): Promise<PositionsResponse<IbrSwapPosition>> => {
  const response: PositionsResponse<IbrSwapPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const params: Record<string, unknown> = {};
    if (companyId) params.p_company_id = companyId;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_ibr_swap_positions', params);
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

export const fetchTesPositions = async (
  companyId?: string,
): Promise<PositionsResponse<TesPosition>> => {
  const response: PositionsResponse<TesPosition> = {
    data: [],
    error: undefined,
  };
  try {
    const params: Record<string, unknown> = {};
    if (companyId) params.p_company_id = companyId;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_tes_positions', params);
    if (error) {
      response.error = 'Error fetching TES positions';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching TES positions';
    return response;
  }
};
