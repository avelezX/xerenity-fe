// Types for the internal resolver MVP (/admin/resolver-lab).
// Backed by xerenity.resolve_query + xerenity.log_resolver_query +
// xerenity.rate_resolver_match RPCs.

export type MatchSource =
  | 'exact:slice'
  | 'exact:table'
  | 'alias:slice'
  | 'alias:table'
  | 'trgm:slice'
  | 'trgm:table'
  | 'fts:description'
  | 'semantic:slice'
  | 'semantic:table';

export interface ResolverMatch {
  table_name: string;
  table_label: string | null;
  slice_column: string | null;
  slice_value: string | null;
  /** Label of the matched item — slice label if slice match, table label otherwise */
  label: string | null;
  category: string | null;
  /** 0..1 — higher is more confident */
  confidence: number;
  match_source: MatchSource;
}

export type Vote = -1 | 1;

export interface ResolverLogEntry {
  id: string;
  query_text: string;
  results: ResolverMatch[];
  result_count: number;
  user_id: string | null;
  created_at: string;
}

export interface ResolverMatchScore {
  table_name: string;
  slice_value: string | null;
  thumbs_up: number;
  thumbs_down: number;
  total_votes: number;
  pct_positive: number | null;
  last_voted_at: string;
}
