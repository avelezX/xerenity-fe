import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * OAuth callback page.
 *
 * Supabase v2 uses PKCE flow by default: tokens arrive as ?code=... query
 * param. The code_verifier needed for exchange is stored client-side in
 * cookies by createClientComponentClient, so the exchange MUST happen here
 * (not on a server-side API route which loses access to the code_verifier).
 */
export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

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

    // PKCE flow: exchange code client-side (code_verifier is in cookies)
    const code = queryParams.get('code');

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchErr }) => {
        if (exchErr) {
          router.replace(
            `/login?error=${encodeURIComponent(exchErr.message)}`,
          );
        } else {
          router.replace('/suameca');
        }
      });
      return undefined;
    }

    // Implicit flow fallback: tokens in hash fragment
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
