// Thin RPC wrappers for the data catalog (sources, tables, consumers,
// per-pair review). All endpoints super_admin-gated server-side.
// Errors are normalised to { ok: false, error } so callers don't have
// to know about Supabase's error shape.

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  CollectorFullDetail,
  DataConsumer,
  DataSource,
  DataTableMeta,
  ReviewStatus,
} from 'src/types/catalog';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface ActionResponse {
  ok: boolean;
  error?: string;
}

export interface DataResponse<T> {
  data: T | null;
  error?: string;
}


// ── reads ─────────────────────────────────────────────────────

export async function getCollectorFullDetail(
  collectorName: string,
): Promise<DataResponse<CollectorFullDetail>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_collector_full_detail', { p_collector: collectorName });
    if (error) return { data: null, error: error.message };
    return { data: data as CollectorFullDetail, error: undefined };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function listDataSources(): Promise<DataResponse<DataSource[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_data_sources');
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DataSource[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function listDataTables(): Promise<DataResponse<DataTableMeta[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_data_tables');
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DataTableMeta[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function listDataConsumers(): Promise<DataResponse<DataConsumer[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_data_consumers');
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DataConsumer[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function listDistinctClassification(
  entity: 'data_sources' | 'data_tables_meta',
  field: 'country' | 'category' | 'source_type' | 'consumer_type',
): Promise<DataResponse<string[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_distinct_classification', { p_entity: entity, p_field: field });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as string[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}


// ── writes (super_admin only) ─────────────────────────────────

export async function updateCollectorMetadata(
  name: string,
  sourceName: string | null,
  notes: string | null,
): Promise<ActionResponse> {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_collector_metadata', {
        p_name: name,
        p_source_name: sourceName,
        p_notes: notes,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function updateCollectorTableReview(
  collectorName: string,
  tableName: string,
  status: ReviewStatus,
  notes: string | null,
): Promise<ActionResponse> {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_collector_table_review', {
        p_collector: collectorName,
        p_table: tableName,
        p_status: status,
        p_notes: notes,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function updateDataSource(
  source: Partial<DataSource> & { name: string; label: string },
): Promise<ActionResponse> {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_data_source', { p_payload: source });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function updateDataTable(
  table: Partial<DataTableMeta> & { table_name: string; date_column: string },
): Promise<ActionResponse> {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_data_table', { p_payload: table });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function updateDataConsumer(
  consumer: Partial<DataConsumer> & { name: string; consumer_type: string; label: string },
): Promise<ActionResponse> {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_data_consumer', { p_payload: consumer });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}
