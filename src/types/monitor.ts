export type Severity = 'critical' | 'warning' | 'info';
export type RunStatus = 'running' | 'success' | 'failed' | 'timeout';
export type AlertSource = 'run_failed' | 'table_stale' | 'missed_run';

export interface LastRun {
  id: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  duration_s: number | null;
  rows_inserted: number | null;
  error_message: string | null;
  gh_run_url: string | null;
}

export interface CollectorOverview {
  name: string;
  description: string | null;
  enabled: boolean;
  severity_default: Severity;
  target_tables: string[];
  schedule_cron: string | null;
  last_run: LastRun | null;
  open_alerts: number;
  has_critical_alert: boolean;
  has_warning_alert: boolean;
}

// Catalog enrichment returned by list_collector_overview_enriched RPC.
// One element per collector. Extends CollectorOverview with the source +
// per-target-table catalog metadata aggregated per-collector.

export interface OverviewSource {
  name: string;
  label: string;
  source_type: 'rest_api' | 'web_scrape' | 'file_download' | 'manual' | null;
  country: string | null;
}

export type ReviewStatusKey =
  | 'pendiente'
  | 'mantener'
  | 'arreglar'
  | 'deprecar'
  | 'documentar';

export type ReviewDistribution = Record<ReviewStatusKey, number> & {
  total: number;
};

export interface CollectorOverviewEnriched extends CollectorOverview {
  source: OverviewSource | null;
  categories: string[];
  countries_data: string[];
  is_critical_any: boolean;
  review_distribution: ReviewDistribution;
}

export interface CollectorRun {
  id: string;
  collector_name: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  status: RunStatus;
  exit_code: number | null;
  rows_inserted: number | null;
  error_message: string | null;
  error_traceback: string | null;
  gh_run_url: string | null;
  gh_workflow: string | null;
  gh_run_id: string | null;
}

export interface CollectorAlert {
  id: string;
  source: AlertSource;
  collector_name: string | null;
  table_name: string | null;
  severity: Severity;
  fingerprint: string;
  title: string;
  body: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  silenced_until: string | null;
  resolved_at: string | null;
}
