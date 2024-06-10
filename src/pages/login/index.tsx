'use client';

import { useState } from 'react';
import { NextPage } from 'next';
import { Image } from 'react-bootstrap';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import LoginForm from './_LoginForm';
import SingUpForm from './_SignUpForm';
import LoginChart from './LoginChart';
import PoweredBy from './_PoweredBy';

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
  width: '200',
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
    <div className="container-fluid h-100">
      <div className="row min-vh-100">
        <div className="bg-white min-vh-100 d-flex flex-column justify-content-between gap-5 px-5 col-md-6 col-lg-7">
          <div className="d-flex flex-column gap-3 py-5">
            <Image
              src={LOGO_SETTINGS.url}
              fluid
              draggable="false"
              width={LOGO_SETTINGS.width}
              alt={LOGO_SETTINGS.alt}
              className="mx-auto d-block pb-3"
            />
            <div className="d-flex justify-content-center">
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
            </div>
            {formTabs[0].active ? (
              <LoginForm captchaKey={CAPTCHA_SITE_KEY} />
            ) : (
              <SingUpForm captchaKey={CAPTCHA_SITE_KEY} />
            )}
          </div>
          <div className="py-5">
            <PoweredBy />
          </div>
        </div>
        <LoginChart />
      </div>
    </div>
  );
};

export default LoginPage;
