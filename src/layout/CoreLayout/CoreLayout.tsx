import React, {
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import { isMobile } from 'react-device-detect';
import Head from 'next/head';
import Sidebar from '@layout/CoreLayout/Sidebar/Sidebar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { deleteCookie, getCookie } from 'cookies-next';
import { useRouter } from 'next/router';
import useAppStore from 'src/store';
import type { Company } from 'src/types/user';
import ChatContainer from '@components/chat/ChatContainer';
import GlobalDateSelector from 'src/components/risk/GlobalDateSelector';
import MobileWarning from './MobileWarning';

const LOGIN_PATH = '/login';

const RISK_PATHS = ['/risk-resumen', '/risk-management', '/loans', '/portfolio', '/ndf-pricer', '/ibr-swap', '/xccy-swap', '/coltes-calculator', '/tes-portfolio'];

function isRiskSection(path: string): boolean {
  return RISK_PATHS.some((p) => path.includes(p));
}

function CompanySelector({ companies, selectedCompanyId, onSelect, onLoad }: {
  companies: Company[];
  selectedCompanyId: string | undefined;
  onSelect: (id: string | undefined) => void;
  onLoad: () => void;
}) {
  useEffect(() => {
    if (companies.length === 0) onLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length]);

  if (companies.length === 0) return null;

  return (
    <div className="company-selector-root">
      <span className="company-selector-label">EMPRESA</span>
      <select
        className="company-selector-select"
        value={selectedCompanyId || ''}
        onChange={(e) => onSelect(e.target.value || undefined)}
      >
        <option value="">Seleccionar...</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <style jsx>{`
        .company-selector-root {
          display: inline-flex;
          align-items: stretch;
          background: #ffffff;
          border: 1px solid #cbd5e1;
        }
        .company-selector-label {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #64748b;
          background: #f8fafc;
          border-right: 1px solid #e2e8f0;
        }
        .company-selector-select {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #0f172a;
          background: #ffffff;
          padding: 5px 28px 5px 10px;
          min-width: 200px;
          border: none;
          outline: none;
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
        }
        .company-selector-select:hover {
          background-color: #f8fafc;
        }
        .company-selector-select:focus-visible {
          outline: 2px solid #9a3412;
          outline-offset: -2px;
        }
      `}</style>
    </div>
  );
}

export default function CoreLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const [mobileUI, setMobileUI] = useState(false);
  const supabase = createClientComponentClient();
  const { loadUserProfile, needsOnboarding, isSuperAdmin, companies, loadCompanies, selectedCompanyId, setSelectedCompanyId } = useAppStore();

  const getRedirect = () => {
    const redirect = getCookie('redirect');
    if (redirect) {
      deleteCookie('redirect');
      return redirect.toString();
    }

    return '/';
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      router.push(LOGIN_PATH);
    } else {
      router.push(LOGIN_PATH);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(getRedirect());
        setMobileUI(false);
        return;
      }

      // Check if user needs onboarding
      await loadUserProfile();
      if (needsOnboarding()) {
        router.push('/onboarding');
        return;
      }

      if (isMobile) {
        setMobileUI(true);
      }
    };

    checkSession();

    // Listen for auth state changes (handles OAuth redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push(LOGIN_PATH);
        setMobileUI(false);
      } else if (session && isMobile) {
        setMobileUI(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <>
      <Head>
        <title>Xerenity</title>
        <meta name="description" content="Xerenity Financial tools" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {mobileUI ? (
        <MobileWarning onLogout={logout} />
      ) : (
        <div className="layout-wrapper">
          <Sidebar />
          <div className="layout-content">
            {isRiskSection(router.pathname) && (
              <div className="risk-context-bar">
                {isSuperAdmin() ? (
                  <CompanySelector
                    companies={companies}
                    selectedCompanyId={selectedCompanyId}
                    onSelect={setSelectedCompanyId}
                    onLoad={loadCompanies}
                  />
                ) : null}
                <GlobalDateSelector />
              </div>
            )}
            <style jsx>{`
              .risk-context-bar {
                display: flex;
                align-items: center;
                gap: 24px;
                padding: 10px 20px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                flex-wrap: wrap;
                font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
              }
            `}</style>
            <div>{children}</div>
          </div>
        </div>
      )}
      <ChatContainer />
    </>
  );
}
