/**
 * Vitest setup — runs once before all tests.
 *
 * `@testing-library/jest-dom/vitest` extends `expect` with custom matchers
 * like `toBeInTheDocument()`, `toHaveTextContent()`, etc.
 *
 * Dummy env vars: several modules (e.g. `src/models/loans/fetchCashFlows`)
 * initialize a Supabase client at module-load time, which throws if
 * NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.
 * Tests that exercise pure helpers don't actually use the client, so dummy
 * values are fine. Tests that need real Supabase behavior should use MSW
 * (sub-issue #327).
 */
import '@testing-library/jest-dom/vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://dummy.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'dummy-anon-key';
process.env.NEXT_PUBLIC_PYSDK_URL ||= 'https://dummy-pysdk.local';
