'use client';

import { Image } from 'react-bootstrap';
import Button from '@components/UI/Button';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';

import Alert from '@components/UI/Alert';

import {
  CardBody,
  CardContainer,
  CardFooter,
} from '@components/UI/Card/Card.styled';
import PoweredBy from '../_PoweredBy';

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '400',
  alt: 'xerenity logo',
};

function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>();

  const accesToken = searchParams.get('access_token');
  const email = searchParams.get('email');

  const approveOtpAccount = async () => {
    if (accesToken && email) {
      const res = await supabase.auth.verifyOtp({
        type: 'invite',
        token: accesToken,
        email,
      });
      if (res.error) {
        setError(res.error.message);
      } else {
        router.push('/suameca');
      }
    } else {
      setError('No Access Token');
    }
  };

  return (
    <div className="container-fluid w-50 h-90">
      <div className=" row min-vh-100">
        <div className="bg-white min-vh-100 d-flex flex-column justify-content-between">
          <Image
            src={LOGO_SETTINGS.url}
            fluid
            draggable="false"
            width={LOGO_SETTINGS.width}
            alt={LOGO_SETTINGS.alt}
            className="mx-auto d-block pb-3"
          />
          <CardContainer>
            <CardBody>Aprueva tu nueva cuenta de Xerenity!</CardBody>
            <CardFooter>
              <div className="flex">
                <Button onClick={() => approveOtpAccount()}>Aprobar</Button>
              </div>
            </CardFooter>
          </CardContainer>
          {error && <Alert>{error}</Alert>}
          <PoweredBy />
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
