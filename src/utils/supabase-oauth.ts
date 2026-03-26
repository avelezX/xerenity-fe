import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for OAuth flows only.
 *
 * Uses localStorage (default) instead of the auth-helpers' cookie storage.
 * This ensures the PKCE code_verifier persists reliably across the OAuth
 * redirect chain (login → provider → callback).
 *
 * After successful code exchange, the session must be synced to the
 * cookie-based client (createClientComponentClient) for the rest of the app.
 */
export default function createOAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    },
  );
}
