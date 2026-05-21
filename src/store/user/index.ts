import { StateCreator } from 'zustand';
import {
  UserProfile,
  CompanyUser,
  Company,
  Invitation,
  UserRole,
  ROLE_HIERARCHY,
} from 'src/types/user';
import { defaultEvaluationDate, formatISO } from 'src/lib/risk/dateHelpers';
import {
  fetchUserProfile,
  listCompanyUsers,
  listAllUsers,
  listCompanies,
  listInvitations,
  inviteUser as inviteUserRpc,
  updateUserRole as updateUserRoleRpc,
  deactivateUser as deactivateUserRpc,
  createCompany as createCompanyRpc,
  setAccountType as setAccountTypeRpc,
  listCompaniesByDomain as listCompaniesByDomainRpc,
  updateCompany as updateCompanyRpc,
  deleteCompany as deleteCompanyRpc,
  assignUserToCompany as assignUserToCompanyRpc,
} from 'src/models/user';

export interface UserSlice {
  // State
  userProfile: UserProfile | null;
  companyUsers: CompanyUser[];
  allUsers: (CompanyUser & { company_name?: string })[];
  companies: Company[];
  domainCompanies: Company[];
  invitations: Invitation[];
  userLoading: boolean;
  userError: string | undefined;

  // Computed getters
  isSuperAdmin: () => boolean;
  isCorpAdmin: () => boolean;
  canManageUsers: () => boolean;
  hasMinRole: (role: UserRole) => boolean;
  needsOnboarding: () => boolean;

  // Actions
  loadUserProfile: () => Promise<void>;
  loadCompanyUsers: () => Promise<void>;
  loadAllUsers: () => Promise<void>;
  loadCompanies: () => Promise<void>;
  loadCompaniesByDomain: (domain: string) => Promise<void>;
  loadInvitations: () => Promise<void>;
  setAccountType: (accountType: string, companyId?: string) => Promise<{ success: boolean; error?: string }>;
  inviteUser: (email: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  deactivateUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  createCompany: (name: string, nit: string | null, domain?: string | null) => Promise<{ success: boolean; error?: string; data?: { id: string } }>;
  updateCompany: (companyId: string, name: string, nit: string | null, domain: string | null) => Promise<{ success: boolean; error?: string }>;
  deleteCompany: (companyId: string) => Promise<{ success: boolean; error?: string }>;
  assignUserToCompany: (userId: string, companyId: string | null, accountType: string) => Promise<{ success: boolean; error?: string }>;
  resetUserStore: () => void;

  // Global company selector (for super_admin viewing other companies)
  selectedCompanyId: string | undefined;
  setSelectedCompanyId: (id: string | undefined) => void;
  /** Returns selectedCompanyId if set, otherwise userProfile.company_id */
  activeCompanyId: () => string | undefined;

  // Global evaluation date (for risk module). Persisted in localStorage.
  // Format: ISO string "YYYY-MM-DD". El consumidor SIEMPRE recibe un string ISO.
  // El `mode` es solo UI: 'month' usa el ultimo dia habil del mes, 'day' usa
  // el dia tal cual seleccionado.
  globalEvaluationDate: string;
  dateSelectorMode: 'month' | 'day';
  setGlobalEvaluationDate: (date: string) => void;
  setDateSelectorMode: (mode: 'month' | 'day') => void;
  /** Returns globalEvaluationDate (always defined; falls back to default). */
  activeEvaluationDate: () => string;

  // Lote seleccionado del modulo cafe. Persistido en localStorage.
  // Es un UUID de xerenity.cafe_lotes. undefined = "no hay lote elegido"
  // (la UI muestra primer lote disponible o pide crear uno).
  selectedLoteId: string | undefined;
  setSelectedLoteId: (id: string | undefined) => void;
}

// localStorage keys (versioned para futuras migraciones de schema)
const LS_DATE_KEY = 'xerenity.globalEvaluationDate.v1';
const LS_MODE_KEY = 'xerenity.dateSelectorMode.v1';
const LS_LOTE_KEY = 'xerenity.selectedLoteId.v1';

function loadDateFromStorage(): string {
  if (typeof window === 'undefined') return formatISO(defaultEvaluationDate());
  try {
    const stored = window.localStorage.getItem(LS_DATE_KEY);
    // Validacion basica: debe ser YYYY-MM-DD
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  } catch {
    // localStorage puede fallar en modo privado / Safari ITP
  }
  return formatISO(defaultEvaluationDate());
}

function loadModeFromStorage(): 'month' | 'day' {
  if (typeof window === 'undefined') return 'month';
  try {
    const stored = window.localStorage.getItem(LS_MODE_KEY);
    if (stored === 'month' || stored === 'day') return stored;
  } catch {
    // ignore
  }
  return 'month';
}

function saveDateToStorage(date: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_DATE_KEY, date);
  } catch {
    // ignore (localStorage full, private mode, etc.)
  }
}

function saveModeToStorage(mode: 'month' | 'day'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

function loadLoteFromStorage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem(LS_LOTE_KEY);
    // Validacion basica: debe ser UUID v4-like
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function saveLoteToStorage(id: string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(LS_LOTE_KEY, id);
    else window.localStorage.removeItem(LS_LOTE_KEY);
  } catch {
    // ignore
  }
}

const initialUserState = {
  userProfile: null as UserProfile | null,
  companyUsers: [] as CompanyUser[],
  allUsers: [] as (CompanyUser & { company_name?: string })[],
  companies: [] as Company[],
  domainCompanies: [] as Company[],
  invitations: [] as Invitation[],
  userLoading: false,
  userError: undefined as string | undefined,
  selectedCompanyId: undefined as string | undefined,
};

const createUserSlice: StateCreator<UserSlice> = (set, get) => ({
  ...initialUserState,

  isSuperAdmin: () => get().userProfile?.role === 'super_admin',
  isCorpAdmin: () => get().userProfile?.role === 'corp_admin',
  canManageUsers: () => {
    const role = get().userProfile?.role;
    return role === 'super_admin' || role === 'corp_admin';
  },
  hasMinRole: (requiredRole: UserRole) => {
    const currentRole = get().userProfile?.role;
    if (!currentRole) return false;
    const currentIdx = ROLE_HIERARCHY.indexOf(currentRole);
    const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);
    return currentIdx >= requiredIdx;
  },
  needsOnboarding: () => {
    const { userProfile } = get();
    return userProfile !== null && userProfile.account_type === null;
  },

  loadUserProfile: async () => {
    set({ userLoading: true, userError: undefined });
    const profile = await fetchUserProfile();
    set({ userProfile: profile, userLoading: false });
  },

  loadCompanyUsers: async () => {
    set({ userLoading: true, userError: undefined });
    const res = await listCompanyUsers();
    if (res.error) {
      set({ userLoading: false, userError: res.error });
      return;
    }
    set({ companyUsers: res.data, userLoading: false });
  },

  loadAllUsers: async () => {
    set({ userLoading: true, userError: undefined });
    const res = await listAllUsers();
    if (res.error) {
      set({ userLoading: false, userError: res.error });
      return;
    }
    set({ allUsers: res.data, userLoading: false });
  },

  loadCompanies: async () => {
    set({ userLoading: true, userError: undefined });
    const res = await listCompanies();
    if (res.error) {
      set({ userLoading: false, userError: res.error });
      return;
    }
    set({ companies: res.data, userLoading: false });
  },

  loadCompaniesByDomain: async (domain: string) => {
    set({ userLoading: true, userError: undefined });
    const res = await listCompaniesByDomainRpc(domain);
    if (res.error) {
      set({ userLoading: false, userError: res.error });
      return;
    }
    set({ domainCompanies: res.data, userLoading: false });
  },

  setAccountType: async (accountType: string, companyId?: string) => {
    set({ userLoading: true, userError: undefined });
    const res = await setAccountTypeRpc(accountType, companyId);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    // Refresh user profile
    await get().loadUserProfile();
    return { success: true };
  },

  loadInvitations: async () => {
    set({ userLoading: true, userError: undefined });
    const res = await listInvitations();
    if (res.error) {
      set({ userLoading: false, userError: res.error });
      return;
    }
    set({ invitations: res.data, userLoading: false });
  },

  inviteUser: async (email: string, role: UserRole) => {
    set({ userLoading: true, userError: undefined });
    const res = await inviteUserRpc(email, role);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    // Refresh invitations list
    await get().loadInvitations();
    return { success: true };
  },

  updateUserRole: async (userId: string, role: UserRole) => {
    set({ userLoading: true, userError: undefined });
    const res = await updateUserRoleRpc(userId, role);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    // Refresh user lists
    if (get().isSuperAdmin()) {
      await get().loadAllUsers();
    } else {
      await get().loadCompanyUsers();
    }
    return { success: true };
  },

  deactivateUser: async (userId: string) => {
    set({ userLoading: true, userError: undefined });
    const res = await deactivateUserRpc(userId);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    // Refresh user lists
    if (get().isSuperAdmin()) {
      await get().loadAllUsers();
    } else {
      await get().loadCompanyUsers();
    }
    return { success: true };
  },

  createCompany: async (name: string, nit: string | null, domain?: string | null) => {
    set({ userLoading: true, userError: undefined });
    const res = await createCompanyRpc(name, nit, domain);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    await get().loadCompanies();
    return { success: true, data: res.data };
  },

  updateCompany: async (companyId: string, name: string, nit: string | null, domain: string | null) => {
    set({ userLoading: true, userError: undefined });
    const res = await updateCompanyRpc(companyId, name, nit, domain);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    await get().loadCompanies();
    return { success: true };
  },

  deleteCompany: async (companyId: string) => {
    set({ userLoading: true, userError: undefined });
    const res = await deleteCompanyRpc(companyId);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    await get().loadCompanies();
    return { success: true };
  },

  assignUserToCompany: async (userId: string, companyId: string | null, accountType: string) => {
    set({ userLoading: true, userError: undefined });
    const res = await assignUserToCompanyRpc(userId, companyId, accountType);
    set({ userLoading: false });
    if (res.error) {
      set({ userError: res.error });
      return { success: false, error: res.error };
    }
    await get().loadAllUsers();
    return { success: true };
  },

  resetUserStore: () => set(initialUserState),

  selectedCompanyId: undefined,
  setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
  activeCompanyId: () => {
    const { selectedCompanyId: selected, userProfile } = get();
    return selected || userProfile?.company_id || undefined;
  },

  globalEvaluationDate: loadDateFromStorage(),
  dateSelectorMode: loadModeFromStorage(),
  setGlobalEvaluationDate: (date) => {
    saveDateToStorage(date);
    set({ globalEvaluationDate: date });
  },
  setDateSelectorMode: (mode) => {
    saveModeToStorage(mode);
    set({ dateSelectorMode: mode });
  },
  activeEvaluationDate: () => get().globalEvaluationDate,

  selectedLoteId: loadLoteFromStorage(),
  setSelectedLoteId: (id) => {
    saveLoteToStorage(id);
    set({ selectedLoteId: id });
  },
});

export default createUserSlice;
