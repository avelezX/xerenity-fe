import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * OAuth callback page.
 *
 * Handles two flows:
 * 1. PKCE flow (Azure/Microsoft): tokens arrive as ?code=... query param.
 *    The code must be exchanged server-side so auth-helpers can set HTTP-only
 *    session cookies. We redirect to /api/auth/callback for this.
 * 2. Implicit flow: tokens arrive as #access_token=... hash fragment.
 *    The Supabase client processes the hash client-side.
 */
export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // PKCE flow: code in query params → redirect to server-side handler
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      router.replace(`/api/auth/callback?code=${code}`);
      return undefined;
    }

    // Implicit flow: tokens in hash fragment → wait for client-side processing
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
