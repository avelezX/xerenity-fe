import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Client-side OAuth callback page.
 * Supabase implicit flow sends tokens as URL hash fragments (#access_token=...)
 * which are only visible to the browser, not the server.
 * This page detects the session client-side and redirects.
 */
export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/suameca');
      } else {
        router.replace('/login?error=oauth_session_failed');
      }
    });
  }, [supabase, router]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: '#666',
      }}
    >
      Autenticando...
    </div>
  );
}
