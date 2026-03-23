import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export type BlotterSortingState = { id: string; desc: boolean }[];

export type BlotterPreferences = {
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnSizing: Record<string, number>;
  sorting: BlotterSortingState;
  estadoFilter: string;
  globalFilter: string;
};

export const DEFAULT_BLOTTER_PREFERENCES: BlotterPreferences = {
  columnOrder: [
    'type', 'id_operacion', 'counterparty', 'sociedad', 'notional',
    'tasa_strike', 'trade_date', 'maturity_date', 'estado',
    'npv_cop', 'npv_usd', 'carry_cop', 'dv01', 'dv01_2', 'fx_delta', 'actions',
  ],
  columnVisibility: {
    type: true, id_operacion: true, counterparty: true, sociedad: true,
    notional: true, tasa_strike: true, trade_date: true, maturity_date: true,
    estado: true, npv_cop: true, npv_usd: true, carry_cop: true,
    dv01: true, dv01_2: true, fx_delta: true, actions: true,
    // Columnas ocultas por defecto
    forward: false, forward_points: false, days_to_maturity: false,
    par_basis_bps: false, fair_rate: false, direction: false, strike: false,
    pnl_rate_cop: false, pnl_fx_cop: false, carry_daily_diff_bps: false,
    // P&L comparativo (ocultas por defecto)
    pnl_1d_cop: false, pnl_mtd_cop: false, pnl_ytd_cop: false,
    pnl_1d_usd: false, pnl_mtd_usd: false, pnl_ytd_usd: false,
  },
  columnSizing: {},
  sorting: [],
  estadoFilter: 'Todos',
  globalFilter: '',
};

const LS_KEY = 'blotter_prefs_v1';

function loadFromLocalStorage(userId?: string): BlotterPreferences {
  try {
    const key = userId ? `${LS_KEY}_${userId}` : LS_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_BLOTTER_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<BlotterPreferences>;
    return { ...DEFAULT_BLOTTER_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_BLOTTER_PREFERENCES;
  }
}

function saveToLocalStorage(prefs: BlotterPreferences, userId?: string) {
  try {
    const key = userId ? `${LS_KEY}_${userId}` : LS_KEY;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

async function syncToSupabase(prefs: BlotterPreferences, userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);
  await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, blotter_prefs: prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

export function useBlotterPreferences(userId?: string) {
  const [prefs, setPrefsState] = useState<BlotterPreferences>(DEFAULT_BLOTTER_PREFERENCES);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loaded = loadFromLocalStorage(userId);
    setPrefsState(loaded);
    initializedRef.current = true;
  }, [userId]);

  const setPrefs = useCallback((updater: BlotterPreferences | ((prev: BlotterPreferences) => BlotterPreferences)) => {
    setPrefsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Save immediately to localStorage
      saveToLocalStorage(next, userId);
      // Debounced sync to Supabase
      if (userId) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          syncToSupabase(next, userId).catch(() => {
            // Silently fail — localStorage is the source of truth
          });
        }, 800);
      }
      return next;
    });
  }, [userId]);

  return { prefs, setPrefs };
}
