'use client';

import { useState } from 'react';
import { NextPage } from 'next';
import { Image } from 'react-bootstrap';
import LoginForm from './_LoginForm';
import SignUpForm from './_SignUpForm';
import LoginChart from './_LoginChart';
import PoweredBy from './_PoweredBy';
import LoginContainer from './_LoginContainer.styled';
import strings from '../../strings/login.json';

const { form } = strings;

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '150',
  alt: 'xerenity logo',
};

type AuthTab = 'login' | 'signup';

const LoginPage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

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
          <div className="login-tabs">
            <button
              type="button"
              className={activeTab === 'login' ? 'active' : ''}
              onClick={() => setActiveTab('login')}
            >
              {form.tabLogin}
            </button>
            <button
              type="button"
              className={activeTab === 'signup' ? 'active' : ''}
              onClick={() => setActiveTab('signup')}
            >
              {form.tabSignup}
            </button>
          </div>
          <div className="login-forms">
            {activeTab === 'login' ? <LoginForm /> : <SignUpForm />}
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
