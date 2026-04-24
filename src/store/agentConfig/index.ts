import { StateCreator } from 'zustand';
import type {
  AgentSkill,
  AgentSkillVersion,
  AgentSuggestion,
  NewSkill,
  NewSuggestion,
} from 'src/types/agent-config';
import * as m from 'src/models/agentConfig';

export interface AgentConfigSlice {
  // Skills state
  agentSkills: AgentSkill[];
  agentSkillsLoading: boolean;
  agentSkillsError: string | undefined;
  agentSkillVersions: AgentSkillVersion[];
  agentSkillVersionsLoading: boolean;

  // Suggestions state
  agentSuggestions: AgentSuggestion[];
  agentSuggestionsLoading: boolean;

  // Skills actions
  loadAgentSkills: () => Promise<void>;
  createAgentSkill: (skill: NewSkill) => Promise<{ success: boolean; error?: string }>;
  updateAgentSkill: (
    id: string,
    updates: Partial<NewSkill>,
    changeNote: string,
  ) => Promise<{ success: boolean; error?: string }>;
  toggleAgentSkill: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteAgentSkill: (id: string) => Promise<{ success: boolean; error?: string }>;
  loadAgentSkillVersions: (skillId: string) => Promise<void>;
  revertAgentSkill: (
    skillId: string,
    versionId: string,
    changeNote: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Suggestions actions
  loadAgentSuggestions: () => Promise<void>;
  createAgentSuggestion: (s: NewSuggestion) => Promise<{ success: boolean; error?: string }>;
  updateAgentSuggestion: (
    id: string,
    updates: Partial<NewSuggestion>,
  ) => Promise<{ success: boolean; error?: string }>;
  toggleAgentSuggestion: (
    id: string,
    active: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAgentSuggestion: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const initialState = {
  agentSkills: [],
  agentSkillsLoading: false,
  agentSkillsError: undefined,
  agentSkillVersions: [],
  agentSkillVersionsLoading: false,
  agentSuggestions: [],
  agentSuggestionsLoading: false,
};

const createAgentConfigSlice: StateCreator<AgentConfigSlice> = (set, get) => ({
  ...initialState,

  loadAgentSkills: async () => {
    set({ agentSkillsLoading: true });
    const res = await m.listAgentSkills();
    set({
      agentSkills: res.data,
      agentSkillsError: res.error,
      agentSkillsLoading: false,
    });
  },

  createAgentSkill: async (skill) => {
    const res = await m.createAgentSkill(skill);
    if (res.success) await get().loadAgentSkills();
    return res;
  },

  updateAgentSkill: async (id, updates, changeNote) => {
    const res = await m.updateAgentSkill(id, updates, changeNote);
    if (res.success) await get().loadAgentSkills();
    return res;
  },

  toggleAgentSkill: async (id, active) => {
    const res = await m.toggleAgentSkill(id, active);
    if (res.success) await get().loadAgentSkills();
    return res;
  },

  deleteAgentSkill: async (id) => {
    const res = await m.deleteAgentSkill(id);
    if (res.success) await get().loadAgentSkills();
    return res;
  },

  loadAgentSkillVersions: async (skillId) => {
    set({ agentSkillVersionsLoading: true });
    const res = await m.listAgentSkillVersions(skillId);
    set({
      agentSkillVersions: res.data,
      agentSkillVersionsLoading: false,
    });
  },

  revertAgentSkill: async (skillId, versionId, changeNote) => {
    const res = await m.revertAgentSkill(skillId, versionId, changeNote);
    if (res.success) {
      await get().loadAgentSkills();
      await get().loadAgentSkillVersions(skillId);
    }
    return res;
  },

  loadAgentSuggestions: async () => {
    set({ agentSuggestionsLoading: true });
    const res = await m.listAgentSuggestions();
    set({
      agentSuggestions: res.data,
      agentSuggestionsLoading: false,
    });
  },

  createAgentSuggestion: async (s) => {
    const res = await m.createAgentSuggestion(s);
    if (res.success) await get().loadAgentSuggestions();
    return res;
  },

  updateAgentSuggestion: async (id, updates) => {
    const res = await m.updateAgentSuggestion(id, updates);
    if (res.success) await get().loadAgentSuggestions();
    return res;
  },

  toggleAgentSuggestion: async (id, active) => {
    const res = await m.toggleAgentSuggestion(id, active);
    if (res.success) await get().loadAgentSuggestions();
    return res;
  },

  deleteAgentSuggestion: async (id) => {
    const res = await m.deleteAgentSuggestion(id);
    if (res.success) await get().loadAgentSuggestions();
    return res;
  },
});

export default createAgentConfigSlice;
