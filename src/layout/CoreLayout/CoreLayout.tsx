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
    <div style={{ padding: '8px 16px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Empresa:</span>
      <select
        value={selectedCompanyId || ''}
        onChange={(e) => onSelect(e.target.value || undefined)}
        style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 200 }}
      >
        <option value="">Seleccionar empresa...</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
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
            {isSuperAdmin() && isRiskSection(router.pathname) && (
              <CompanySelector
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                onSelect={setSelectedCompanyId}
                onLoad={loadCompanies}
              />
            )}
            <div>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
