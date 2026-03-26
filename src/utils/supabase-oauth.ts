import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for OAuth flows.
 *
 * Uses implicit flow (no PKCE) to avoid code_verifier storage issues
 * with the auth-helpers cookie adapter. Tokens arrive as hash fragments
 * which are processed client-side on the callback page.
 */
export default function createOAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
      },
    },
  );
}
