'use client';

import { NextPage } from 'next';
import { Image,Tabs,Tab } from 'react-bootstrap';
import LoginForm from './LoginForm';
import LoginChart from './LoginChart';
import SingUpForm from './SignUpForm';

const LoginPage: NextPage = () => (
  <div className="container-fluid h-100">
    <div className="row min-vh-100">
      <div className="bg-white min-vh-100 d-flex flex-column justify-content-center px-5 col-xs-12 col-md-6 col-lg-7">
        <Image
          src="/assets/img/brand/logo.svg"
          fluid
          width="200"
          alt="xerenity logo"
          className="mx-auto d-block"
        />
        <div className="justify-content-center pb-3" >
          <div className="gap-2">
          <Tabs defaultActiveKey="login">
              <Tab eventKey="login" title='Iniciar Session'>
                <LoginForm />
              </Tab>
              <Tab eventKey="signup" title='Crear Cuenta'>
                <SingUpForm/>
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>
      <LoginChart />
    </div>
  </div>
);

export default LoginPage;
