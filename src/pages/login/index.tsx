'use client';

import { useState } from 'react';
import { NextPage } from 'next';
import { Image } from 'react-bootstrap';
import { TabItemType } from '@components/UI/Tabs';
import LoginForm from './_LoginForm';
import LoginChart from './_LoginChart';
import PoweredBy from './_PoweredBy';
import LoginContainer from './_LoginContainer.styled';

// fyi: Order of this array afects rendering
const TAB_ITEMS: TabItemType[] = [
  {
    name: 'Iniciar Sesion',
    property: 'login',
    active: true,
  },
];

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '150',
  alt: 'xerenity logo',
};

const LoginPage: NextPage = () => {
  const [formTabs, setTabs] = useState(TAB_ITEMS);

  const handleTabChange = (prop: string) => {
    setTabs((prevState) =>
      prevState.map((tab) => ({
        ...tab,
        active: tab.property === prop,
      }))
    );
  };

  return (
    <LoginContainer>
      <aside className="form-wrapper">
        <div className="container">
          <Image
            src={LOGO_SETTINGS.url}
            fluid
            draggable="false"
            width={LOGO_SETTINGS.width}
            alt={LOGO_SETTINGS.alt}
            className="mx-auto d-block pb-3"
          />
          <div className="login-forms">
            <LoginForm />
          </div>
        </div>
        <PoweredBy />
      </aside>
      <figure className="chart-wrapper">
        <LoginChart />
      </figure>
    </LoginContainer>
  );
};

export default LoginPage;
