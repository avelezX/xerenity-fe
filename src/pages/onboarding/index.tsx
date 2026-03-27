import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Image } from 'react-bootstrap';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import styled from 'styled-components';
import Alert from '@components/UI/Alert';
import Spinner from '@components/UI/Spinner';
import useAppStore from 'src/store';
import { extractDomain } from 'src/utils/email-domain';
import AccountTypeStep from './_AccountTypeStep';
import CompanyStep from './_CompanyStep';
import strings from '../../strings/onboarding.json';

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '150',
  alt: 'xerenity logo',
};

type OnboardingStep = 'account-type' | 'company';

const PageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f8f9fa;

  .onboarding-card {
    background: white;
    border-radius: 16px;
    padding: 40px;
    max-width: 600px;
    width: 100%;
    margin: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;

    .title {
      font-size: 22px;
      font-weight: 600;
      color: #302b63;
      margin-top: 16px;
    }

    .subtitle {
      font-size: 14px;
      color: #8e8e8e;
      margin-top: 4px;
    }
  }
`;

function OnboardingPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [step, setStep] = useState<OnboardingStep>('account-type');
  const [error, setError] = useState('');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const {
    userProfile,
    userLoading,
    domainCompanies,
    loadUserProfile,
    loadCompaniesByDomain,
    setAccountType,
    createCompany,
  } = useAppStore();

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      setUserEmail(session.user.email ?? '');
      await loadUserProfile();
      setSessionChecked(true);
    };
    checkSession();
  }, [supabase, router, loadUserProfile]);

  // Redirect if user already completed onboarding
  useEffect(() => {
    if (sessionChecked && userProfile && userProfile.account_type !== null) {
      router.replace('/suameca');
    }
  }, [sessionChecked, userProfile, router]);

  const domain = extractDomain(userEmail);

  const handleSelectType = async (type: 'individual' | 'corporate') => {
    setError('');
    if (type === 'individual') {
      const res = await setAccountType('individual');
      if (res.success) {
        router.replace('/suameca');
      } else {
        setError(res.error ?? 'Error al configurar cuenta');
      }
    } else {
      // Load companies matching email domain
      if (domain) {
        await loadCompaniesByDomain(domain);
      }
      setStep('company');
    }
  };

  const handleJoinCompany = async (companyId: string) => {
    setError('');
    const res = await setAccountType('corporate', companyId);
    if (res.success) {
      router.replace('/suameca');
    } else {
      setError(res.error ?? 'Error al unirse a la empresa');
    }
  };

  const handleCreateCompany = async (name: string, nit: string) => {
    setError('');
    const createRes = await createCompany(name, nit || null, domain || null);
    if (!createRes.success) {
      setError(createRes.error ?? 'Error al crear empresa');
      return;
    }

    if (createRes.data?.id) {
      const res = await setAccountType('corporate', createRes.data.id);
      if (res.success) {
        router.replace('/suameca');
      } else {
        setError(res.error ?? 'Error al configurar cuenta');
      }
    }
  };

  if (!sessionChecked) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  }

  return (
    <>
      <Head>
        <title>Xerenity - Configurar cuenta</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </Head>
      <PageContainer>
        <div className="onboarding-card">
          <Image
            src={LOGO_SETTINGS.url}
            fluid
            draggable="false"
            width={LOGO_SETTINGS.width}
            alt={LOGO_SETTINGS.alt}
            className="mx-auto d-block"
          />
          <h1 className="title">{strings.title}</h1>
          <p className="subtitle">{strings.subtitle}</p>

          {error && <Alert>{error}</Alert>}

          {step === 'account-type' && (
            <AccountTypeStep
              onSelect={handleSelectType}
              loading={userLoading}
            />
          )}

          {step === 'company' && (
            <CompanyStep
              domain={domain}
              domainCompanies={domainCompanies}
              loading={userLoading}
              onJoin={handleJoinCompany}
              onCreate={handleCreateCompany}
              onBack={() => setStep('account-type')}
            />
          )}
        </div>
      </PageContainer>
    </>
  );
}

export default OnboardingPage;
