/**
 * TanStack Query hooks for derivatives positions (xccy, ndf, ibr swaps).
 *
 * Phase 2 (#299) sub-issue #317 — replaces the position-list state and CRUD
 * actions in `src/store/trading/index.ts` for the **derivatives** flow.
 *
 * TES queda fuera del scope de Fase 2 — se maneja por separado.
 *
 * Pattern:
 * - `useXxxPositions(companyId)` → list query, key includes companyId so
 *   switching company invalidates correctly.
 * - `useAddXxxPosition()` / `useRemoveXxxPositions()` → mutations that
 *   invalidate the list on success.
 *
 * Why this matters for the user-visible bugs:
 * - Adding a position no longer needs the `repriceTrigger` counter from #295.
 *   When the mutation invalidates `['positions', 'xccy', companyId]`, the
 *   list refetches with the new position, then `useRepricePortfolio` sees
 *   a different ID set in its key and refetches automatically.
 * - The store's manual `xccyPositions: [...state.xccyPositions, localPos]`
 *   optimistic update is replaced by query invalidation. No more "where did
 *   my position go after a refresh?" desync.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchXccyPositions,
  fetchNdfPositions,
  fetchIbrSwapPositions,
  createXccyPosition,
  createNdfPosition,
  createIbrSwapPosition,
  deleteXccyPositions,
  deleteNdfPositions,
  deleteIbrSwapPositions,
} from 'src/models/trading';
import type {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
} from 'src/types/trading';

export const tradingKeys = {
  xccyPositions: (companyId?: string) =>
    ['positions', 'xccy', companyId ?? null] as const,
  ndfPositions: (companyId?: string) =>
    ['positions', 'ndf', companyId ?? null] as const,
  ibrSwapPositions: (companyId?: string) =>
    ['positions', 'ibrSwap', companyId ?? null] as const,
  /** All position lists across all companies — used for invalidation broadcast. */
  allPositions: ['positions'] as const,
};

const POSITIONS_STALE_MS = 60_000;

// ── List queries ──

export function useXccyPositions(companyId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tradingKeys.xccyPositions(companyId),
    queryFn: async () => {
      const res = await fetchXccyPositions(companyId);
      if (res.error) throw new Error(res.error);
      return res.data as XccyPosition[];
    },
    enabled: options?.enabled ?? true,
    staleTime: POSITIONS_STALE_MS,
  });
}

export function useNdfPositions(companyId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tradingKeys.ndfPositions(companyId),
    queryFn: async () => {
      const res = await fetchNdfPositions(companyId);
      if (res.error) throw new Error(res.error);
      return res.data as NdfPosition[];
    },
    enabled: options?.enabled ?? true,
    staleTime: POSITIONS_STALE_MS,
  });
}

export function useIbrSwapPositions(companyId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tradingKeys.ibrSwapPositions(companyId),
    queryFn: async () => {
      const res = await fetchIbrSwapPositions(companyId);
      if (res.error) throw new Error(res.error);
      return res.data as IbrSwapPosition[];
    },
    enabled: options?.enabled ?? true,
    staleTime: POSITIONS_STALE_MS,
  });
}

// ── Mutations: create ──

export function useAddXccyPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createXccyPosition as (v: NewXccyPosition) => Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'xccy'] });
    },
  });
}

export function useAddNdfPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNdfPosition as (v: NewNdfPosition) => Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'ndf'] });
    },
  });
}

export function useAddIbrSwapPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIbrSwapPosition as (v: NewIbrSwapPosition) => Promise<unknown>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'ibrSwap'] });
    },
  });
}

// ── Mutations: delete ──

export function useRemoveXccyPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteXccyPositions(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'xccy'] });
    },
  });
}

export function useRemoveNdfPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteNdfPositions(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'ndf'] });
    },
  });
}

export function useRemoveIbrSwapPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteIbrSwapPositions(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions', 'ibrSwap'] });
    },
  });
}
