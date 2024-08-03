'use client';

import { useState } from 'react';
import { NextPage } from 'next';
import { Image } from 'react-bootstrap';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import LoginForm from './_LoginForm';
import SingUpForm from './_SignUpForm';
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
  {
    name: 'Registrarme',
    property: 'register',
    active: false,
  },
];

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '150',
  alt: 'xerenity logo',
};

const CAPTCHA_SITE_KEY = '593e53a4-0b84-4d8a-a7e6-a3dc4098b152';

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
          <nav className="login-tabs">
            <Tabs>
              {formTabs.map(({ active, name, property }) => (
                <Tab
                  active={active}
                  key={name}
                  onClick={() => handleTabChange(property)}
                >
                  {name}
                </Tab>
              ))}
            </Tabs>
          </nav>
          <div className="login-forms">
            {formTabs[0].active ? (
              <LoginForm captchaKey={CAPTCHA_SITE_KEY} />
            ) : (
              <SingUpForm captchaKey={CAPTCHA_SITE_KEY} />
            )}
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
