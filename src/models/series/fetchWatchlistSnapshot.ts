import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LightSerieEntry } from 'src/types/lightserie';
import { WatchlistEntry, DashboardConfig } from 'src/types/watchlist';

const SCHEMA = 'xerenity';
const TABLE_NAME = 'search_mv';
const RPC_NAME = 'search';
const BATCH_SIZE = 50;

const supabase = createClientComponentClient();

export type WatchlistSnapshotResponse = {
  data: WatchlistEntry[];
  error: string | undefined;
};

export const fetchWatchlistMetadata = async (
  filters: DashboardConfig['filters']
): Promise<WatchlistSnapshotResponse> => {
  const response: WatchlistSnapshotResponse = {
    data: [],
    error: undefined,
  };

  try {
    let query = supabase.schema(SCHEMA).from(TABLE_NAME).select();

    if (filters.grupos && filters.grupos.length > 0) {
      query = query.in('grupo', filters.grupos);
    }
    if (filters.fuentes && filters.fuentes.length > 0) {
      query = query.in('fuente', filters.fuentes);
    }
    if (filters.subGroups && filters.subGroups.length > 0) {
      query = query.in('sub_group', filters.subGroups);
    }

    const { data, error } = await query;

    if (error) {
      response.error = 'Error al cargar metadata de series';
      return response;
    }

    const entries: WatchlistEntry[] = (data as LightSerieEntry[]).map((s) => ({
      ticker: s.ticker,
      source_name: s.source_name,
      display_name: s.display_name,
      grupo: s.grupo,
      sub_group: s.sub_group,
      fuente: s.fuente,
      entidad: s.entidad,
      activo: s.activo,
      tipo_fondo: s.tipo_fondo ?? null,
      clase_activo: s.clase_activo ?? null,
      latest_value: null,
      latest_date: null,
      change: null,
      pct_change: null,
    }));

    response.data = entries;
    return response;
  } catch (e) {
    response.error = 'Error al cargar metadata de series';
    return response;
  }
};

type LatestValues = {
  ticker: string;
  latest_value: number | null;
  latest_date: string | null;
  change: number | null;
  pct_change: number | null;
};

const fetchLatestForTicker = async (
  ticker: string
): Promise<LatestValues> => {
  const result: LatestValues = {
    ticker,
    latest_value: null,
    latest_date: null,
    change: null,
    pct_change: null,
  };

  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc(RPC_NAME, { ticket: ticker });

    if (error || !data?.data || data.data.length < 1) {
      return result;
    }

    const points = data.data as { time: string; value: number }[];
    const len = points.length;

    if (len >= 1) {
      result.latest_value = points[len - 1].value;
      result.latest_date = points[len - 1].time;
    }
    if (len >= 2) {
      const prev = points[len - 2].value;
      const curr = points[len - 1].value;
      result.change = curr - prev;
      result.pct_change = prev !== 0 ? ((curr - prev) / prev) * 100 : 0;
    }

    return result;
  } catch {
    return result;
  }
};

const processBatch = (batch: string[]): Promise<PromiseSettledResult<LatestValues>[]> =>
  Promise.allSettled(batch.map((t) => fetchLatestForTicker(t)));

export const fetchLatestValuesBatch = async (
  tickers: string[]
): Promise<Map<string, LatestValues>> => {
  const batches: string[][] = [];
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE));
  }

  const allBatchResults = await Promise.all(batches.map(processBatch));
  const results = new Map<string, LatestValues>();

  allBatchResults.forEach((batchResults) => {
    batchResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        results.set(r.value.ticker, r.value);
      }
    });
  });

  return results;
};
