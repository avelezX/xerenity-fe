import { StateCreator } from 'zustand';
import {
  UserProfile,
  CompanyUser,
  Company,
  Invitation,
  UserRole,
  ROLE_HIERARCHY,
} from 'src/types/user';
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
  resetUserStore: () => void;
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

  resetUserStore: () => set(initialUserState),
});

export default createUserSlice;
