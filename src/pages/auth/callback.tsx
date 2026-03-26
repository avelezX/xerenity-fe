import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * OAuth callback page.
 *
 * Handles three scenarios:
 * 1. Error from provider: ?error=... or #error=... → show on login page.
 * 2. PKCE flow (Azure/Microsoft): ?code=... → server-side exchange.
 * 3. Implicit flow: #access_token=... → client-side processing.
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

    // PKCE flow: code in query params → server-side exchange
    const code = queryParams.get('code');

    if (code) {
      router.replace(`/api/auth/callback?code=${code}`);
      return undefined;
    }

    // Implicit flow: tokens in hash fragment → client-side processing
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
