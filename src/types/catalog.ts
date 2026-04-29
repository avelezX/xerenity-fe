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
}
