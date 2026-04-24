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

// eslint-disable-next-line import/prefer-default-export
export async function buildSystemPrompt(
  userName?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: SupabaseClient | any,
): Promise<string> {
  const greeting = userName ? `El usuario actual es ${userName}.` : '';
  const header = `${greeting}`.trim();

  if (!supabase) {
    return header || 'Eres el asistente de IA de Xerenity.';
  }

  const skills = await loadActiveSkills(supabase);

  const body = skills
    .map((s) => s.content.trim())
    .join('\n\n');

  return [header, body].filter(Boolean).join('\n\n');
}
