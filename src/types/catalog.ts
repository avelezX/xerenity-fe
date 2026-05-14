// Types mirror the data_sources / data_tables_meta / data_consumers /
// collector_table_review tables added in xerenity-db migrations
// 20260429_data_catalog_foundation.sql + companion seeds.
//
// Field shapes match what the get_collector_full_detail RPC returns
// (one round-trip; everything the catalog tab needs).

export type SourceType =
  | 'rest_api'
  | 'web_scrape'
  | 'file_download'
  | 'manual';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export type ConsumerType =
  | 'fe_page'
  | 'agent_tool'
  | 'external_api'
  | 'export'
  | 'notebook'
  | 'script'
  | 'sdk';

export type ReviewStatus =
  | 'pendiente'
  | 'mantener'
  | 'arreglar'
  | 'deprecar'
  | 'documentar';


export interface DataSource {
  name: string;
  label: string;
  country: string | null;
  source_type: SourceType | null;
  base_url: string | null;
  docs_url: string | null;
  auth_required: boolean;
  publish_schedule: string | null;
  health_status: HealthStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataTableMeta {
  table_name: string;
  schema_name: string;
  label: string | null;
  date_column: string;
  slice_column: string | null;
  slice_label_sql: string | null;
  category: string | null;
  country: string | null;
  description: string | null;
  is_critical: boolean;
  created_at: string;
  updated_at: string;
}

export interface DataConsumer {
  name: string;
  consumer_type: ConsumerType;
  label: string;
  path: string | null;
  reads_tables: string[];
  writes_tables: string[];
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollectorTableReview {
  collector_name: string;
  table_name: string;
  review_status: ReviewStatus;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by_email: string | null;
}

// list_collector_series RPC return shape — one entry per target_table
// of the collector. `slices` may include an `error` row if the dynamic
// query against the underlying table failed.

export interface SliceBreakdown {
  slice_value: string;
  last_date: string | null;
  first_date: string | null;
  row_count: number;
  cadence_days: number | null;
}

export interface SliceError {
  error: string;
}

export interface CollectorTableSeries {
  table_name: string;
  meta_present: boolean;
  label?: string | null;
  date_column?: string | null;
  slice_column?: string | null;
  category?: string | null;
  country?: string | null;
  is_critical?: boolean;
  slices: (SliceBreakdown | SliceError)[];
}

// Run-stats aggregate over the last 30 runs of a collector. Returned by
// get_collector_full_detail. Drives the SaludCard at the top of the
// collector detail page so triagers can tell normal "0 rows by design"
// runs from real failures.
export interface CollectorRunStatRecent {
  status: 'success' | 'failed' | 'timeout' | 'running';
  started_at: string;
  rows_inserted: number | null;
  duration_s: number | null;
}

export interface CollectorRunStats {
  total: number;
  success: number;
  failed: number;
  timeout: number;
  running: number;
  with_data: number;
  empty: number;
  // Percentage of *successful* runs that inserted 0 rows. NULL when
  // there are no successful runs to base the ratio on.
  empty_rate_pct: number | null;
  median_duration_s: number | null;
  last_run_at: string | null;
  last_data_run_at: string | null;
  recent: CollectorRunStatRecent[];
}

// Phase 1 of the catalog plan — per-column metadata. Auto-populated from
// information_schema; label/description/unit filled manually.
export interface DataColumnMeta {
  table_name: string;
  column_name: string;
  data_type: string;
  ordinal_position: number;
  is_pk: boolean;
  is_slice_key: boolean;
  is_date_key: boolean;
  label: string | null;
  description: string | null;
  unit: string | null;
  fk_to: string | null;
}

// Phase 1 — slice value dictionary. Explains what each unique value of the
// slice_column means (e.g. cb_rates.codigo='XM' → "Euro area").
export interface DataSliceEntry {
  table_name: string;
  slice_column: string;
  slice_value: string;
  label: string;
  description: string | null;
}

// Phase 1 — per-target-table dictionary returned by get_collector_full_detail.
// Key is the table_name; value is { columns, slices } arrays.
export type CollectorDictionary = Record<
  string,
  { columns: DataColumnMeta[]; slices: DataSliceEntry[] }
>;

// get_collector_full_detail return shape

export interface CollectorFullDetail {
  definition: {
    name: string;
    description: string | null;
    repo: string | null;
    repo_path: string | null;
    workflow_file: string | null;
    schedule_cron: string | null;
    expected_frequency: string | null;
    target_tables: string[];
    severity: 'critical' | 'warning' | 'info';
    teams_mention: boolean;
    enabled: boolean;
    source_name: string | null;
    notes: string | null;
    updated_at: string;
  };
  source: DataSource | null;
  series: CollectorTableSeries[];
  reviews: CollectorTableReview[];
  consumers: DataConsumer[];
  run_stats: CollectorRunStats | null;
  dictionary: CollectorDictionary | null;
}


// ──────────────────────────────────────────────────────────────────────
// Phase 2 — public data catalog (visible to any authenticated user)
// ──────────────────────────────────────────────────────────────────────

// Row returned by list_data_catalog_overview. One per table_meta with
// writer/reader counts and source attribution for the overview page.
export interface DataCatalogOverviewEntry {
  table_name: string;
  label: string | null;
  category: string | null;
  country: string | null;
  is_critical: boolean;
  description: string | null;
  date_column: string;
  slice_column: string | null;
  n_collectors_writing: number;
  n_consumers: number;
  sources: string[];
  n_slice_values: number;
}

// Returned by get_table_lineage(table_name).
export interface TableLineageWriter {
  name: string;
  description: string | null;
  enabled: boolean;
  severity: 'critical' | 'warning' | 'info';
  source_name: string | null;
  schedule_cron: string | null;
  expected_frequency: string | null;
}

export interface TableLineageReader {
  name: string;
  consumer_type: string;
  label: string;
  path: string | null;
  enabled: boolean;
  writes_tables: string[];
  description: string | null;
}

export interface TableLineage {
  writers: TableLineageWriter[];
  readers: TableLineageReader[];
}

// Returned by get_table_freshness(table_name).
export interface TableFreshnessOverall {
  row_count: number;
  first_date: string | null;
  last_date: string | null;
  age_hours: number | null;
  error?: string;
}

export interface TableFreshnessPerSlice {
  slice_value: string;
  row_count: number;
  first_date: string | null;
  last_date: string | null;
}

export interface TableFreshness {
  overall: TableFreshnessOverall;
  // per_slice is an array when slice_column is set; can be the literal []
  // when there is no slice_column. May be an error object if dynamic SQL
  // failed (e.g. column type mismatch). The detail page guards both.
  per_slice: TableFreshnessPerSlice[] | { error: string };
}

// Returned by describe_table (already exists in Phase 1 RPCs).
export interface TableDescription {
  meta: DataTableMeta;
  columns: DataColumnMeta[];
  slices: DataSliceEntry[];
}
