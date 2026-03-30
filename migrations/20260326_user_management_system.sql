-- ============================================================
-- Xerenity User Management System
-- Run in Supabase SQL Editor
-- ============================================================
-- This script is IDEMPOTENT: safe to run multiple times.
-- It creates: companies, user_profiles, invitations tables
-- and all RPC functions needed by the frontend.
-- ============================================================

-- 1. COMPANIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS xerenity.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. USER PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS xerenity.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'individual' CHECK (account_type IN ('corporate', 'individual')),
  company_id uuid REFERENCES xerenity.companies(id),
  role text NOT NULL DEFAULT 'lector' CHECK (role IN ('super_admin', 'corp_admin', 'gestor', 'lector')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. INVITATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS xerenity.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'lector' CHECK (role IN ('super_admin', 'corp_admin', 'gestor', 'lector')),
  company_id uuid REFERENCES xerenity.companies(id),
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- 4. RLS POLICIES
-- ============================================================
ALTER TABLE xerenity.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE xerenity.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE xerenity.invitations ENABLE ROW LEVEL SECURITY;

-- user_profiles: users can read their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_read_own_profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY users_read_own_profile ON xerenity.user_profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- companies: authenticated users can read companies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_companies' AND tablename = 'companies') THEN
    CREATE POLICY authenticated_read_companies ON xerenity.companies
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Grant access
GRANT SELECT ON xerenity.companies TO authenticated;
GRANT SELECT ON xerenity.user_profiles TO authenticated;
GRANT SELECT ON xerenity.invitations TO authenticated;

-- 5. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
BEGIN
  INSERT INTO xerenity.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION xerenity.handle_new_user();

-- 6. RPC: get_user_profile
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.get_user_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'account_type', p.account_type,
    'company_id', p.company_id,
    'company_name', c.name,
    'role', p.role,
    'is_active', p.is_active
  ) INTO result
  FROM xerenity.user_profiles p
  LEFT JOIN xerenity.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid();

  RETURN result;
END;
$$;

-- 7. RPC: list_company_users
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.list_company_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_company_id uuid;
  result json;
BEGIN
  SELECT company_id INTO caller_company_id
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_company_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'role', p.role,
    'is_active', p.is_active,
    'created_at', p.created_at
  )), '[]'::json) INTO result
  FROM xerenity.user_profiles p
  WHERE p.company_id = caller_company_id;

  RETURN result;
END;
$$;

-- 8. RPC: list_all_users (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.list_all_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  result json;
BEGIN
  SELECT role INTO caller_role
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'role', p.role,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'company_name', c.name
  )), '[]'::json) INTO result
  FROM xerenity.user_profiles p
  LEFT JOIN xerenity.companies c ON c.id = p.company_id;

  RETURN result;
END;
$$;

-- 9. RPC: list_companies (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.list_companies()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  result json;
BEGIN
  SELECT role INTO caller_role
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', c.id,
    'name', c.name,
    'nit', c.nit,
    'created_at', c.created_at
  )), '[]'::json) INTO result
  FROM xerenity.companies c;

  RETURN result;
END;
$$;

-- 10. RPC: create_company (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.create_company(p_name text, p_nit text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: requires super_admin role';
  END IF;

  INSERT INTO xerenity.companies (name, nit) VALUES (p_name, p_nit);
END;
$$;

-- 11. RPC: update_user_role
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  caller_company_id uuid;
  target_company_id uuid;
BEGIN
  SELECT role, company_id INTO caller_role, caller_company_id
  FROM xerenity.user_profiles WHERE id = auth.uid();

  -- super_admin can change anyone
  IF caller_role = 'super_admin' THEN
    UPDATE xerenity.user_profiles SET role = p_role WHERE id = p_user_id;
    RETURN;
  END IF;

  -- corp_admin can change users in same company (but not to super_admin)
  IF caller_role = 'corp_admin' THEN
    SELECT company_id INTO target_company_id
    FROM xerenity.user_profiles WHERE id = p_user_id;

    IF target_company_id != caller_company_id THEN
      RAISE EXCEPTION 'Forbidden: cannot modify users outside your company';
    END IF;

    IF p_role = 'super_admin' THEN
      RAISE EXCEPTION 'Forbidden: cannot assign super_admin role';
    END IF;

    UPDATE xerenity.user_profiles SET role = p_role WHERE id = p_user_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Forbidden: insufficient permissions';
END;
$$;

-- 12. RPC: deactivate_user
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.deactivate_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  caller_company_id uuid;
  target_company_id uuid;
BEGIN
  SELECT role, company_id INTO caller_role, caller_company_id
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role = 'super_admin' THEN
    UPDATE xerenity.user_profiles SET is_active = false WHERE id = p_user_id;
    RETURN;
  END IF;

  IF caller_role = 'corp_admin' THEN
    SELECT company_id INTO target_company_id
    FROM xerenity.user_profiles WHERE id = p_user_id;

    IF target_company_id != caller_company_id THEN
      RAISE EXCEPTION 'Forbidden: cannot modify users outside your company';
    END IF;

    UPDATE xerenity.user_profiles SET is_active = false WHERE id = p_user_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Forbidden: insufficient permissions';
END;
$$;

-- 13. RPC: invite_user
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.invite_user(p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  caller_company_id uuid;
BEGIN
  SELECT role, company_id INTO caller_role, caller_company_id
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role NOT IN ('super_admin', 'corp_admin') THEN
    RAISE EXCEPTION 'Forbidden: insufficient permissions';
  END IF;

  IF caller_role = 'corp_admin' AND p_role = 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: cannot invite super_admin';
  END IF;

  INSERT INTO xerenity.invitations (email, role, company_id, invited_by)
  VALUES (p_email, p_role, caller_company_id, auth.uid());
END;
$$;

-- 14. RPC: list_invitations
-- ============================================================
CREATE OR REPLACE FUNCTION xerenity.list_invitations()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = xerenity
AS $$
DECLARE
  caller_role text;
  caller_company_id uuid;
  result json;
BEGIN
  SELECT role, company_id INTO caller_role, caller_company_id
  FROM xerenity.user_profiles WHERE id = auth.uid();

  IF caller_role = 'super_admin' THEN
    SELECT COALESCE(json_agg(json_build_object(
      'id', i.id, 'email', i.email, 'role', i.role,
      'status', i.status, 'created_at', i.created_at, 'expires_at', i.expires_at
    )), '[]'::json) INTO result
    FROM xerenity.invitations i;
  ELSIF caller_role = 'corp_admin' THEN
    SELECT COALESCE(json_agg(json_build_object(
      'id', i.id, 'email', i.email, 'role', i.role,
      'status', i.status, 'created_at', i.created_at, 'expires_at', i.expires_at
    )), '[]'::json) INTO result
    FROM xerenity.invitations i
    WHERE i.company_id = caller_company_id;
  ELSE
    RETURN '[]'::json;
  END IF;

  RETURN result;
END;
$$;

-- 15. GRANT EXECUTE on all RPCs to authenticated users
-- ============================================================
GRANT EXECUTE ON FUNCTION xerenity.get_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.list_company_users() TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.list_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.list_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.create_company(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.update_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.deactivate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.invite_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION xerenity.list_invitations() TO authenticated;

-- ============================================================
-- 16. BOOTSTRAP: Set YOUR user as super_admin
-- ============================================================
-- IMPORTANT: Run this AFTER the tables are created.
-- Replace the email below with YOUR actual Supabase auth email.
-- ============================================================

-- Option A: If you know your email
-- UPDATE xerenity.user_profiles SET role = 'super_admin' WHERE email = 'TU_EMAIL_AQUI';

-- Option B: If your profile doesn't exist yet (first time), insert it
-- INSERT INTO xerenity.user_profiles (id, email, full_name, role, account_type)
-- SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''), 'super_admin', 'corporate'
-- FROM auth.users WHERE email = 'TU_EMAIL_AQUI'
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- Option C: Make ALL existing users visible (useful for first run)
-- This lists all auth users so you can pick yours:
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at;
