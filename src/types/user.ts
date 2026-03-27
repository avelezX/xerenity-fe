export type AccountType = 'corporate' | 'individual';
export type UserRole = 'super_admin' | 'corp_admin' | 'gestor' | 'lector';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  account_type: AccountType | null;
  company_id: string | null;
  company_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface CompanyUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  nit: string | null;
  domain: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

/** Role hierarchy for permission checks (higher index = more permissions) */
export const ROLE_HIERARCHY: UserRole[] = ['lector', 'gestor', 'corp_admin', 'super_admin'];
