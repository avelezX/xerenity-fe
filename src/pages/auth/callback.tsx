import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import createOAuthClient from '../../utils/supabase-oauth';

/**
 * OAuth callback page.
 *
 * Uses a dedicated OAuth client (localStorage-based) for the PKCE code
 * exchange, then syncs the session to the cookie-based client that the
 * rest of the app uses.
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.replace('#', ''),
    );

    // Check for OAuth errors in both query string and hash fragment
    const error =
      queryParams.get('error_description') ||
      hashParams.get('error_description') ||
      queryParams.get('error') ||
      hashParams.get('error');

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return undefined;
    }

    // PKCE flow: exchange code using the OAuth client (localStorage has the code_verifier)
    const code = queryParams.get('code');

    if (code) {
      const oauthClient = createOAuthClient();
      oauthClient.auth.exchangeCodeForSession(code).then(({ data, error: exchErr }) => {
        if (exchErr || !data.session) {
          const msg = exchErr?.message || 'no_session';
          router.replace(`/login?error=${encodeURIComponent(msg)}`);
          return;
        }

        // Sync session to the cookie-based client used by the rest of the app
        const supabase = createClientComponentClient();
        supabase.auth
          .setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
          .then(() => {
            router.replace('/suameca');
          });
      });
      return undefined;
    }

    // Implicit flow fallback: tokens in hash fragment
    const supabase = createClientComponentClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();
        router.replace('/suameca');
      }
    });

    // Fallback: if no auth event fires within 5s, check session directly
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/suameca');
      } else {
        router.replace('/login?error=oauth_timeout');
      }
      subscription.unsubscribe();
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

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
