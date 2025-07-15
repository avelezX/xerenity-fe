'use client';

import { NextPage } from 'next';
import { Image } from 'react-bootstrap';
import LoginForm from './_LoginForm';
import LoginChart from './_LoginChart';
import PoweredBy from './_PoweredBy';
import LoginContainer from './_LoginContainer.styled';

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '150',
  alt: 'xerenity logo',
};

const LoginPage: NextPage = () => (
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

export default LoginPage;
