import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  UserProfile,
  CompanyUser,
  Company,
  Invitation,
  UserRole,
} from 'src/types/user';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_user_profile');
    if (error || !data) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
};

export type ListResponse<T> = {
  data: T[];
  error: string | undefined;
};

export const listCompanyUsers = async (): Promise<ListResponse<CompanyUser>> => {
  const response: ListResponse<CompanyUser> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_company_users');
    if (error) {
      response.error = 'Error fetching company users';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching company users';
    return response;
  }
};

export const inviteUser = async (
  email: string,
  role: UserRole,
): Promise<{ success: boolean; error: string | undefined }> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('invite_user', { p_email: email, p_role: role });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch {
    return { success: false, error: 'Error inviting user' };
  }
};

export const updateUserRole = async (
  userId: string,
  role: UserRole,
): Promise<{ success: boolean; error: string | undefined }> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('update_user_role', { p_user_id: userId, p_role: role });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch {
    return { success: false, error: 'Error updating user role' };
  }
};

export const deactivateUser = async (
  userId: string,
): Promise<{ success: boolean; error: string | undefined }> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('deactivate_user', { p_user_id: userId });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch {
    return { success: false, error: 'Error deactivating user' };
  }
};

export const listAllUsers = async (): Promise<ListResponse<CompanyUser & { company_name?: string }>> => {
  const response: ListResponse<CompanyUser & { company_name?: string }> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_all_users');
    if (error) {
      response.error = 'Error fetching all users';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching all users';
    return response;
  }
};

export const listCompanies = async (): Promise<ListResponse<Company>> => {
  const response: ListResponse<Company> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_companies');
    if (error) {
      response.error = 'Error fetching companies';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching companies';
    return response;
  }
};

export const createCompany = async (
  name: string,
  nit: string | null,
  domain: string | null = null,
): Promise<{ success: boolean; error: string | undefined; data?: { id: string } }> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('create_company', { p_name: name, p_nit: nit, p_domain: domain });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined, data: data ?? undefined };
  } catch {
    return { success: false, error: 'Error creating company' };
  }
};

export const setAccountType = async (
  accountType: string,
  companyId?: string,
): Promise<{ success: boolean; error: string | undefined }> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('set_account_type', {
        p_account_type: accountType,
        p_company_id: companyId ?? null,
      });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch {
    return { success: false, error: 'Error setting account type' };
  }
};

export const listCompaniesByDomain = async (
  domain: string,
): Promise<ListResponse<Company>> => {
  const response: ListResponse<Company> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_companies_by_domain', { p_domain: domain });
    if (error) {
      response.error = 'Error fetching companies by domain';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching companies by domain';
    return response;
  }
};

export const listInvitations = async (): Promise<ListResponse<Invitation>> => {
  const response: ListResponse<Invitation> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_invitations');
    if (error) {
      response.error = 'Error fetching invitations';
      return response;
    }
    response.data = data ?? [];
    return response;
  } catch {
    response.error = 'Error fetching invitations';
    return response;
  }
};
