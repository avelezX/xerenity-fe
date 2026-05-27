// RPC wrappers for the resolver MVP. All endpoints are super_admin-gated
// server-side; the FE additionally gates the page via <RoleGuard>.

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  ResolverMatch,
  ResolverLogEntry,
  ResolverMatchScore,
  Vote,
} from 'src/types/resolver';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface DataResponse<T> {
  data: T | null;
  error?: string;
}

export interface ActionResponse {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Call xerenity.resolve_query(text, int, vector). Returns ranked matches.
 * If `embedding` is provided, the engine adds the semantic layer
 * (cosine similarity over pgvector) on top of the literal layers.
 */
export async function resolveQuery(
  text: string,
  limit = 10,
  embedding: number[] | null = null,
): Promise<DataResponse<ResolverMatch[]>> {
  try {
    const params: Record<string, unknown> = {
      p_text: text,
      p_limit: limit,
    };
    if (embedding && embedding.length > 0) {
      // Postgres accepts vector(...) as a string literal '[1,2,3,...]'.
      // postgrest-js forwards this through; cast to vector happens on the
      // server side based on the column/parameter type.
      params.p_embedding = `[${embedding.join(',')}]`;
    }
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('resolve_query', params);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ResolverMatch[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

/**
 * Get OpenAI embedding for an arbitrary text via the server-side proxy.
 * Used by the lab to embed user queries before calling resolveQuery.
 */
export async function embedText(
  text: string,
): Promise<DataResponse<number[]>> {
  try {
    const r = await fetch('/api/resolver/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = (await r.json()) as { embedding?: number[]; error?: string };
    if (!r.ok) {
      return { data: null, error: json.error ?? `HTTP ${r.status}` };
    }
    if (!Array.isArray(json.embedding)) {
      return { data: null, error: 'No embedding in response' };
    }
    return { data: json.embedding };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

/**
 * Persist a resolve_query call + its results. Returns the log id, used to
 * attach thumbs feedback to specific matches.
 */
export async function logResolverQuery(
  query: string,
  results: ResolverMatch[],
): Promise<DataResponse<string>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('log_resolver_query', {
        p_query: query,
        p_results: results,
      });
    if (error) return { data: null, error: error.message };
    return { data: data as string };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

/**
 * Submit a thumbs up/down on a specific result.
 */
export async function rateResolverMatch(
  logId: string,
  tableName: string,
  sliceValue: string | null,
  vote: Vote,
  note?: string | null,
): Promise<ActionResponse> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('rate_resolver_match', {
        p_log_id: logId,
        p_table_name: tableName,
        p_slice_value: sliceValue,
        p_vote: vote,
        p_note: note ?? null,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id?: string } | null)?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

/**
 * Recent test queries (super_admin only). Most-recent first.
 */
export async function listRecentResolverLogs(
  limit = 25,
): Promise<DataResponse<ResolverLogEntry[]>> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('resolver_test_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ResolverLogEntry[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}

/**
 * Aggregate thumbs scores per (table, slice).
 */
export async function listResolverMatchScore(): Promise<
  DataResponse<ResolverMatchScore[]>
> {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('resolver_match_score')
      .select('*')
      .order('thumbs_down', { ascending: false })
      .limit(50);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ResolverMatchScore[] };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
}
