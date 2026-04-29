import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CPIPoint,
  CPISnapshot,
  CPIContribution,
  InflationCanasta,
  CityCPIPoint,
  CitySnapshot,
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

export const fetchCanastaTree = async (): Promise<Result<InflationCanasta[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_canasta_tree');
    if (error) return fail(error.message);
    return { data: (data ?? []) as InflationCanasta[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching canasta tree');
  }
};

export const fetchCitySeries = async (
  ciudad: string
): Promise<Result<CityCPIPoint[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_city_series', { ciudad_search: ciudad });
    if (error) return fail(error.message);
    return { data: (data ?? []) as CityCPIPoint[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching city series');
  }
};

export const fetchCitySnapshot = async (
  targetDate?: string
): Promise<Result<CitySnapshot[]>> => {
  try {
    const args = targetDate ? { target_date: targetDate } : {};
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('cpi_city_snapshot', args);
    if (error) return fail(error.message);
    return { data: (data ?? []) as CitySnapshot[], error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching city snapshot');
  }
};

const CORE_SERIES_IDS_YOY = [
  { id: 124, nombre: 'Inflación sin alimentos' },
  { id: 126, nombre: 'Inflación sin alimentos ni regulados' },
  { id: 128, nombre: 'Inflación núcleo 15' },
  { id: 130, nombre: 'Inflación de bienes, sin alimentos ni regulados' },
  { id: 132, nombre: 'Inflación de servicios, sin alimentos ni regulados' },
  { id: 134, nombre: 'Inflación de regulados' },
  { id: 140, nombre: 'Inflación de alimentos' },
];

export const CORE_INFLATION_SERIES = CORE_SERIES_IDS_YOY;

export const fetchCoreInflationSeries = async (
  ids: number[]
): Promise<Result<{ id: number; values: { time: string; value: number }[] }[]>> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('banrep_series_value_v2')
      .select('id_serie,fecha,valor')
      .in('id_serie', ids)
      .order('fecha');
    if (error) return fail(error.message);
    const map = new Map<number, { time: string; value: number }[]>();
    (data ?? []).forEach((r: { id_serie: number; fecha: string; valor: number }) => {
      if (!map.has(r.id_serie)) map.set(r.id_serie, []);
      map.get(r.id_serie)!.push({
        time: String(r.fecha).slice(0, 10),
        value: r.valor,
      });
    });
    const out = Array.from(map.entries()).map(([id, values]) => ({ id, values }));
    return { data: out, error: undefined };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Error fetching core inflation');
  }
};
