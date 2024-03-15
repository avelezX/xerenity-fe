'use client';

import { NextPage } from 'next';
import Image from '@components/UI/Image';
import LoginForm from './LoginForm';
import LoginChart from './LoginChart';

const LoginPage: NextPage = () => (
  <div className="container-fluid h-100">
    <div className="row min-vh-100">
      <div className="bg-white min-vh-100 d-flex flex-column justify-content-center px-5 col-xs-12 col-md-6 col-lg-7">
        <Image
          src="/assets/img/brand/logo.svg"
          fluid
          width="180"
          alt="xerenity logo"
          className="mx-auto d-block"
        />
        <LoginForm />
      </div>
      <LoginChart />
    </div>
  </div>
);

export default LoginPage;
