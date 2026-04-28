/**
 * Helpers to render hooks/components inside a QueryClientProvider for
 * integration tests (sub-issue #327).
 *
 * Each test gets a *fresh* QueryClient with retries disabled and zero
 * cache time — this prevents one test's data from leaking into another
 * and avoids flakes from background refetches.
 */
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, RenderHookOptions } from '@testing-library/react';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function withQueryClient(client?: QueryClient) {
  const queryClient = client ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

/** Convenience: renderHook with a fresh QueryClient. */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>,
) {
  const { queryClient, Wrapper } = withQueryClient();
  const result = renderHook(hook, { ...options, wrapper: Wrapper });
  return { ...result, queryClient };
}

/** Convenience: render a component tree with a fresh QueryClient. */
export function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const { queryClient, Wrapper } = withQueryClient(client);
  const result = render(ui, { wrapper: Wrapper });
  return { ...result, queryClient };
}
