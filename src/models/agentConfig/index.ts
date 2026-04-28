import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type {
  AgentSkill,
  AgentSkillVersion,
  AgentSuggestion,
  NewSkill,
  NewSuggestion,
} from 'src/types/agent-config';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type MutationResponse = { success: boolean; error?: string; data?: unknown };
export type ListResponse<T> = { data: T[]; error?: string };

// ─── Skills ─────────────────────────────────────────────────

export const listAgentSkills = async (): Promise<ListResponse<AgentSkill>> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('list_agent_skills');
    if (error) return { data: [], error: error.message };
    return { data: (data as AgentSkill[]) || [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Error' };
  }
};

export const createAgentSkill = async (skill: NewSkill): Promise<MutationResponse> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_agent_skill', {
      p_name: skill.name,
      p_description: skill.description || null,
      p_content: skill.content,
      p_display_order: skill.display_order,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const updateAgentSkill = async (
  id: string,
  updates: Partial<NewSkill>,
  changeNote: string,
): Promise<MutationResponse> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('update_agent_skill', {
      p_id: id,
      p_name: updates.name ?? null,
      p_description: updates.description ?? null,
      p_content: updates.content ?? null,
      p_display_order: updates.display_order ?? null,
      p_change_note: changeNote,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const toggleAgentSkill = async (id: string, active: boolean): Promise<MutationResponse> => {
  try {
    const { error } = await supabase.schema(SCHEMA).rpc('toggle_agent_skill', {
      p_id: id,
      p_active: active,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const deleteAgentSkill = async (id: string): Promise<MutationResponse> => {
  try {
    const { error } = await supabase.schema(SCHEMA).rpc('delete_agent_skill', { p_id: id });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const listAgentSkillVersions = async (
  skillId: string,
): Promise<ListResponse<AgentSkillVersion>> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('list_agent_skill_versions', {
      p_skill_id: skillId,
    });
    if (error) return { data: [], error: error.message };
    return { data: (data as AgentSkillVersion[]) || [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Error' };
  }
};

export const revertAgentSkill = async (
  skillId: string,
  versionId: string,
  changeNote: string,
): Promise<MutationResponse> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('revert_agent_skill', {
      p_skill_id: skillId,
      p_version_id: versionId,
      p_change_note: changeNote,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

// ─── Suggestions ────────────────────────────────────────────

export const listAgentSuggestions = async (): Promise<ListResponse<AgentSuggestion>> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('list_agent_suggestions');
    if (error) return { data: [], error: error.message };
    return { data: (data as AgentSuggestion[]) || [] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Error' };
  }
};

export const createAgentSuggestion = async (s: NewSuggestion): Promise<MutationResponse> => {
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_agent_suggestion', {
      p_icon: s.icon,
      p_title: s.title,
      p_prompt: s.prompt,
      p_display_order: s.display_order,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const updateAgentSuggestion = async (
  id: string,
  updates: Partial<NewSuggestion>,
): Promise<MutationResponse> => {
  try {
    const { error } = await supabase.schema(SCHEMA).rpc('update_agent_suggestion', {
      p_id: id,
      p_icon: updates.icon ?? null,
      p_title: updates.title ?? null,
      p_prompt: updates.prompt ?? null,
      p_display_order: updates.display_order ?? null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const toggleAgentSuggestion = async (
  id: string,
  active: boolean,
): Promise<MutationResponse> => {
  try {
    const { error } = await supabase.schema(SCHEMA).rpc('toggle_agent_suggestion', {
      p_id: id,
      p_active: active,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const deleteAgentSuggestion = async (id: string): Promise<MutationResponse> => {
  try {
    const { error } = await supabase.schema(SCHEMA).rpc('delete_agent_suggestion', { p_id: id });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};
