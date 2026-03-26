import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import createOAuthClient from '../../utils/supabase-oauth';

/**
 * OAuth callback page.
 *
 * The OAuth client uses implicit flow, so tokens arrive as hash fragments
 * (#access_token=...&refresh_token=...). We create an OAuth client with
 * detectSessionInUrl: true to auto-process the hash, then sync the session
 * to the cookie-based client for the rest of the app.
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const query = window.location.search;

    // Check for errors in query or hash
    const params = new URLSearchParams(query);
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const error =
      params.get('error_description') ||
      hashParams.get('error_description') ||
      params.get('error') ||
      hashParams.get('error');

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return undefined;
    }

    // Create OAuth client — it auto-detects hash fragments on init
    const oauthClient = createOAuthClient();

    // Listen for the session from the hash fragment processing
    const {
      data: { subscription },
    } = oauthClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe();

        // Sync session to cookie-based client for the rest of the app
        const supabase = createClientComponentClient();
        supabase.auth
          .setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          })
          .then(() => {
            router.replace('/suameca');
          });
      }
    });

    // Fallback timeout
    const timeout = setTimeout(async () => {
      // Check if OAuth client got a session
      const { data } = await oauthClient.auth.getSession();
      if (data.session) {
        const supabase = createClientComponentClient();
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
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
