/**
 * useXccySettlements — carga los cashflows trimestrales liquidados de XCCY
 * swaps de la empresa y dispara el calculo+persistencia de los nuevos.
 *
 * Flujo:
 *   1. POST /pricing/xccy/settle (idempotente — solo agrega periodos nuevos).
 *   2. SELECT * FROM trading.xccy_settlement WHERE company_id = X.
 *   3. Retorna { rows, allLoaded } igual que useNdfSettlements.
 *
 * Pattern de anti-flicker: `allLoaded` es false durante el round-trip al
 * settle endpoint. Asi los callers (SummaryBar) pueden gatear el calculo
 * de P&G Realizado para no mostrar valores parciales.
 *
 * Trigger: corre al montar cuando hay XCCYs activos + companyId resuelto.
 * El settle solo se dispara UNA vez por sesion por (companyId, posIds)
 * — con un `useEffect` dependency en el set de IDs. Subsecuentes
 * re-renders solo refrescan el SELECT.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  settleXccyPositions,
  type XccySettleRequestPosition,
} from 'src/models/pricing/pricingApi';
import {
  fetchXccySettlements,
  type XccySettlementRow,
} from 'src/models/trading/fetchXccySettlements';
import type { XccyPosition } from 'src/types/trading';

export interface UseXccySettlementsResult {
  rows: XccySettlementRow[];
  byPosition: Record<string, XccySettlementRow[]>;
  allLoaded: boolean;
  /** Settlements totales esperados (suma desde el ultimo settle exitoso). */
  expectedCount: number;
  resolvedCount: number;
  error: string | null;
}

const today = (): string => new Date().toISOString().slice(0, 10);

const isActiveOrSettled = (p: XccyPosition): boolean => {
  // Active = no esta cancelado y tiene fecha de start <= hoy
  if (p.estado === 'Cancelado') return false;
  if (!p.start_date) return false;
  return p.start_date <= today();
};

const buildSettlePayload = (
  positions: XccyPosition[],
  companyId: string,
): XccySettleRequestPosition[] =>
  positions
    .filter(isActiveOrSettled)
    .map((p) => ({
      id:                       p.id,
      company_id:               companyId,
      notional_usd:             p.notional_usd,
      start_date:               p.start_date,
      maturity_date:            p.maturity_date,
      pay_usd:                  p.pay_usd,
      fx_initial:               p.fx_initial ?? null,
      usd_spread_bps:           p.usd_spread_bps ?? 0,
      cop_spread_bps:           p.cop_spread_bps ?? 0,
      xccy_basis_bps:           0,
      amortization_type:        (p.amortization_type ?? 'bullet') as
        'bullet' | 'linear' | 'custom',
      amortization_schedule:    (p.amortization_schedule as number[] | null) ?? null,
      payment_frequency_months: 3,
    }));

export function useXccySettlements(
  positions: XccyPosition[],
  companyId: string | null | undefined,
): UseXccySettlementsResult {
  const [rows, setRows] = useState<XccySettlementRow[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set estable de IDs activos — para el dep array del useEffect.
  const positionsKey = useMemo(
    () => positions.filter(isActiveOrSettled).map((p) => p.id).sort().join(','),
    [positions],
  );

  useEffect(() => {
    // Reset al cambiar de empresa
    setRows([]);
    setAllLoaded(false);
    setError(null);

    if (!companyId || positionsKey.length === 0) {
      setAllLoaded(true);
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      try {
        // 1) Trigger settle (idempotente) — no esperamos resultado granular
        const payload = buildSettlePayload(positions, companyId);
        if (payload.length > 0) {
          try {
            await settleXccyPositions(payload);
          } catch (e) {
            // No bloqueamos por errores del settle — leemos lo que haya
            // eslint-disable-next-line no-console
            console.warn('[xccy-settle] trigger failed:', e);
          }
        }

        if (cancelled) return;

        // 2) Leer desde Supabase
        const { data, error: fetchErr } = await fetchXccySettlements(companyId);
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr);
          setAllLoaded(true);
          return;
        }
        setRows(data);
        setAllLoaded(true);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error)?.message ?? 'Unknown error');
        setAllLoaded(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey, companyId]);

  const byPosition = useMemo(() => {
    const acc: Record<string, XccySettlementRow[]> = {};
    rows.forEach((r) => {
      if (!acc[r.xccy_position_id]) acc[r.xccy_position_id] = [];
      acc[r.xccy_position_id].push(r);
    });
    return acc;
  }, [rows]);

  return {
    rows,
    byPosition,
    allLoaded,
    expectedCount: positions.filter(isActiveOrSettled).length,
    resolvedCount: Object.keys(byPosition).length,
    error,
  };
}
