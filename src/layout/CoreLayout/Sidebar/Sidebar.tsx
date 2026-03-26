import React from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Image, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import SidebarNavList from './SidebarNavList';

const LOGO_PATH = '/assets/img/brand/logo.svg';
const LOGIN_PATH = '/login';

const getInitials = (email: string, fullName?: string): string => {
  if (fullName && fullName.trim()) {
    return fullName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

const getRoleBadge = (role: string): { label: string; bg: string } | null => {
  switch (role) {
    case 'super_admin':
      return { label: 'Admin', bg: 'danger' };
    case 'corp_admin':
      return { label: 'Admin Corp', bg: 'warning' };
    default:
      return null;
  }
};

const Sidebar = () => {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      router.push(LOGIN_PATH);
    } else {
      router.push(LOGIN_PATH);
    }
  };

  const initials = userProfile ? getInitials(userProfile.email, userProfile.full_name) : '';
  const roleBadge = userProfile ? getRoleBadge(userProfile.role) : null;

  return (
    <div className="layout-sidebar">
      <section className="top-container">
        <figure className="logo-container">
          <Image src={LOGO_PATH} alt="Xerenity Logo" />
        </figure>
        <SidebarNavList currentPath={router.pathname} />
      </section>
      <section className="bottom-container">
        {userProfile && (
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-email" title={userProfile.email}>
                {userProfile.email}
              </span>
              {roleBadge && (
                <Badge bg={roleBadge.bg} className="sidebar-role-badge">
                  {roleBadge.label}
                </Badge>
              )}
            </div>
          </div>
        )}
        <Button $fullwidth variant="outline-primary" onClick={() => logout()}>
          <Icon icon={faShareFromSquare} />
          Salir
        </Button>
      </section>
    </div>
  );
};

export default Sidebar;
