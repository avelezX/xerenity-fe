import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CPIPoint,
  CPISnapshot,
  CPIContribution,
  InflationCanasta,
} from 'src/types/inflation';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type Result<T> = { data: T | undefined; error: string | undefined };

const fail = <T>(message: string): Result<T> => ({ data: undefined, error: message });

export const fetchCanastas = async (): Promise<Result<InflationCanasta[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('canasta')
      .select('id,nombre,peso')
      .order('id');
    if (error) return fail(error.message);
    return { data: (data ?? []) as InflationCanasta[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching canastas');
  }
};

export const fetchCPIFullSeries = async (
  idCanasta: number
): Promise<Result<CPIPoint[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_full_series', { id_canasta_search: idCanasta });
    if (error) return fail(error.message);
    return { data: (data ?? []) as CPIPoint[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching CPI series');
  }
};

export const fetchCPISnapshot = async (
  idCanasta: number
): Promise<Result<CPISnapshot>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_snapshot', { id_canasta_search: idCanasta });
    if (error) return fail(error.message);
    return { data: data as CPISnapshot, error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching CPI snapshot');
  }
};

export const fetchCPIContributions = async (
  monthsBack: number
): Promise<Result<CPIContribution[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_contribution_history', { months_back: monthsBack });
    if (error) return fail(error.message);
    return { data: (data ?? []) as CPIContribution[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching CPI contributions');
  }
};
