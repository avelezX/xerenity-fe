'use client';

import React from 'react';
import { UserRole, ROLE_HIERARCHY } from 'src/types/user';
import useAppStore from 'src/store';

interface RoleGuardProps {
  requiredRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user's role meets or exceeds the required role.
 * Role hierarchy: super_admin > corp_admin > gestor > lector
 */
const RoleGuard: React.FC<RoleGuardProps> = ({ requiredRole, children, fallback = null }) => {
  const userProfile = useAppStore((s) => s.userProfile);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  if (!userProfile) return <>{fallback}</>;

  const currentIdx = ROLE_HIERARCHY.indexOf(userProfile.role);
  const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);

  if (currentIdx >= requiredIdx) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{fallback}</>;
};

export default RoleGuard;
