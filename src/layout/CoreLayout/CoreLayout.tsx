import React, { PropsWithChildren, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Sidebar from '@layout/CoreLayout/Sidebar/Sidebar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { deleteCookie, getCookie } from 'cookies-next';
import { useRouter } from 'next/router';

export default function CoreLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const getRedirect = () => {
    const redirect = getCookie('redirect');
    if (redirect) {
      deleteCookie('redirect');
      return redirect.toString();
    }

    return '/';
  };

  const checkUserLogedIn = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push(getRedirect());
    }
  }, [supabase, router]);

  useEffect(() => {
    checkUserLogedIn();
  }, [checkUserLogedIn]);

  return (
    <>
      <Head>
        <title>Xerenity</title>
        <meta name="description" content="Xerenity Financial tools" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="layout-wrapper">
        <Sidebar />
        <div className="layout-content">
          <div>{children}</div>
        </div>
      </div>
    </>
  );
}
