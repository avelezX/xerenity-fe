// Public-facing catalog RPC wrappers (Phase 2). Anyone authenticated
// can call these — the catalog tells what data exists; the data itself
// is gated by its own RLS/permissions.

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  DataCatalogOverviewEntry,
  DataSource,
  DataConsumer,
  TableLineage,
  TableFreshness,
  TableDescription,
} from 'src/types/catalog';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface DataResponse<T> {
  data: T | null;
  error?: string;
}

export async function listDataCatalogOverview(): Promise<DataResponse<DataCatalogOverviewEntry[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_data_catalog_overview');
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as DataCatalogOverviewEntry[] };
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

export async function describeTable(
  tableName: string,
): Promise<DataResponse<TableDescription>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('describe_table', { p_table: tableName });
    if (error) return { data: null, error: error.message };
    return { data: data as TableDescription };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function getTableLineage(
  tableName: string,
): Promise<DataResponse<TableLineage>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_table_lineage', { p_table: tableName });
    if (error) return { data: null, error: error.message };
    return { data: data as TableLineage };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function getTableFreshness(
  tableName: string,
): Promise<DataResponse<TableFreshness>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_table_freshness', { p_table: tableName });
    if (error) return { data: null, error: error.message };
    return { data: data as TableFreshness };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}
