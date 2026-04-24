export interface AgentSkill {
  id: string;
  name: string;
  description: string | null;
  content: string;
  active: boolean;
  display_order: number;
  current_version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentSkillVersion {
  id: string;
  skill_id: string;
  version_number: number;
  name: string;
  description: string | null;
  content: string;
  change_note: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
}

export interface AgentSuggestion {
  id: string;
  icon: string;
  title: string;
  prompt: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewSkill {
  name: string;
  description: string;
  content: string;
  display_order: number;
}

export interface NewSuggestion {
  icon: string;
  title: string;
  prompt: string;
  display_order: number;
}
