import type { SupabaseClient } from '@supabase/supabase-js';

// In-memory cache to avoid hitting DB on every chat message
const CACHE_TTL_MS = 60_000; // 60 seconds
let cache: { at: number; skills: Array<{ name: string; content: string }> } | null = null;

export function invalidateSkillsCache(): void {
  cache = null;
}

async function loadActiveSkills(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
): Promise<Array<{ name: string; content: string }>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.skills;
  }

  try {
    const { data, error } = await supabase.schema('xerenity').rpc('get_active_agent_skills');
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading agent skills:', error.message);
      return cache?.skills || [];
    }
    const skills = (data as Array<{ name: string; content: string }>) || [];
    cache = { at: now, skills };
    return skills;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Exception loading agent skills:', err);
    return cache?.skills || [];
  }
}

// Static guidance (stable → lives inside the cached system block). Steers the
// agent to use the catalog tools before guessing SQL and sets expectations on
// query_database (read-only + super_admin gated).
const GUIDANCE = [
  'Antes de escribir SQL con query_database, usá las herramientas de catálogo',
  '(list_data_catalog, describe_table, describe_lineage) para descubrir qué tablas',
  'y columnas existen — NO inventes nombres de tablas ni columnas. Para graficar',
  'series preferí find_and_chart_series. query_database es solo-lectura (SELECT) y',
  'requiere permisos de super_admin; si no tenés permiso, explicá al usuario en vez',
  'de reintentar.',
].join(' ');

// eslint-disable-next-line import/prefer-default-export
export async function buildSystemPrompt(
  userName?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: SupabaseClient | any,
): Promise<string> {
  const greeting = userName ? `El usuario actual es ${userName}.` : '';
  const header = `${greeting}`.trim();

  if (!supabase) {
    return [header, GUIDANCE].filter(Boolean).join('\n\n');
  }

  const skills = await loadActiveSkills(supabase);

  const body = skills
    .map((s) => s.content.trim())
    .join('\n\n');

  return [header, GUIDANCE, body].filter(Boolean).join('\n\n');
}
