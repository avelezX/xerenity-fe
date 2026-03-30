import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Image } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faShareFromSquare,
  faChevronUp,
  faUser,
  faBuilding,
  faShieldAlt,
  faEnvelope,
} from '@fortawesome/free-solid-svg-icons';
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

const getRoleLabel = (role: string): { label: string; className: string } => {
  switch (role) {
    case 'super_admin':
      return { label: 'Super Admin', className: 'role-super-admin' };
    case 'corp_admin':
      return { label: 'Admin Corp', className: 'role-corp-admin' };
    case 'gestor':
      return { label: 'Gestor', className: 'role-gestor' };
    default:
      return { label: 'Lector', className: 'role-lector' };
  }
};

const Sidebar = () => {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      router.push(LOGIN_PATH);
    } else {
      router.push(LOGIN_PATH);
    }
  };

  const initials = userProfile ? getInitials(userProfile.email, userProfile.full_name) : '';
  const roleInfo = userProfile ? getRoleLabel(userProfile.role) : null;

  return (
    <div className="layout-sidebar">
      <section className="top-container">
        <figure className="logo-container">
          <Image src={LOGO_PATH} alt="Xerenity Logo" />
        </figure>
        <SidebarNavList currentPath={router.pathname} />
      </section>
      <section className="bottom-container" ref={menuRef}>
        {/* Popover menu */}
        {menuOpen && userProfile && (
          <div className="sidebar-user-popover">
            <div className="popover-header">
              <div className="popover-avatar">{initials}</div>
              <div className="popover-identity">
                <span className="popover-name">
                  {userProfile.full_name || userProfile.email.split('@')[0]}
                </span>
                {roleInfo && (
                  <span className={`popover-role ${roleInfo.className}`}>
                    {roleInfo.label}
                  </span>
                )}
              </div>
            </div>
            <div className="popover-divider" />
            <div className="popover-details">
              <div className="popover-detail-row">
                <Icon icon={faEnvelope} className="popover-icon" />
                <span title={userProfile.email}>{userProfile.email}</span>
              </div>
              <div className="popover-detail-row">
                <Icon icon={faShieldAlt} className="popover-icon" />
                <span>Rol: {roleInfo?.label}</span>
              </div>
              <div className="popover-detail-row">
                <Icon icon={faUser} className="popover-icon" />
                <span>Cuenta: {userProfile.account_type === 'corporate' ? 'Corporativa' : 'Individual'}</span>
              </div>
              {userProfile.company_name && (
                <div className="popover-detail-row">
                  <Icon icon={faBuilding} className="popover-icon" />
                  <span>{userProfile.company_name}</span>
                </div>
              )}
            </div>
            <div className="popover-divider" />
            <button
              type="button"
              className="popover-logout"
              onClick={logout}
            >
              <Icon icon={faShareFromSquare} />
              Cerrar sesión
            </button>
          </div>
        )}

        {/* User button (always visible) */}
        {userProfile && (
          <button
            type="button"
            className="sidebar-user-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">
                {userProfile.full_name || userProfile.email.split('@')[0]}
              </span>
              {roleInfo && (
                <span className={`sidebar-user-role ${roleInfo.className}`}>
                  {roleInfo.label}
                </span>
              )}
            </div>
            <Icon
              icon={faChevronUp}
              className={`sidebar-chevron ${menuOpen ? 'open' : ''}`}
            />
          </button>
        )}
      </section>
    </div>
  );
};

export default Sidebar;
