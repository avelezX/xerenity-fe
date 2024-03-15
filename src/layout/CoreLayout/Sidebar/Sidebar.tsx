import React from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Image } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons';
import Button from '@components/UI/Button';
import SidebarNav from './SidebarNav';

const LOGO_PATH = '/assets/img/brand/logo.svg';
const LOGIN_PATH = '/login';

const Sidebar = () => {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      router.push(LOGIN_PATH);
    } else {
      router.push(LOGIN_PATH);
    }
  };

  return (
    <div className="layout-sidebar">
      <section className="top-container">
        <figure className="logo-container">
          <Image src={LOGO_PATH} alt="Xerenity Logo" />
        </figure>
        <SidebarNav currentPath={router.pathname} />
      </section>
      <section className="bottom-container">
        <Button $fullwidth variant="outline-primary" onClick={() => logout()}>
          <Icon icon={faShareFromSquare} />
          Salir
        </Button>
      </section>
    </div>
  );
};

export default Sidebar;
