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
import MobileWarning from './MobileWarning';

const LOGIN_PATH = '/login';

export default function CoreLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const [mobileUI, setMobileUI] = useState(false);
  const supabase = createClientComponentClient();

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
      } else if (session && isMobile) {
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
            <div>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
