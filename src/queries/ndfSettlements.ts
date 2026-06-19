/**
 * useNdfSettlements — carga el settlement P&L (BanRep TRM al vencimiento)
 * de los NDFs vencidos pasados en `positions`.
 *
 * Backend: GET /pricing/ndf/settlement por cada NDF expired.
 * Formula (en el backend): pyl_cop = sign × notional × (trm_fixing − strike)
 *                          pyl_usd = pyl_cop / trm_fixing
 *
 * Una entrada por NDF expired:
 *   - { trm_fixing, trm_date, pyl_cop, pyl_usd, ... } si exitoso
 *   - 'error' si fallo (TRM no disponible, etc.)
 *
 * Las entradas son inmutables (un vencido en el pasado siempre tiene el mismo
 * P&L) — staleTime alto.
 *
 * Retorna:
 *   - map: Record<id, NdfSettlementResult | 'error'>
 *   - allLoaded: true cuando TODAS las entradas esperadas estan resueltas
 *     (o erroreadas). Usado por callers para ANTI-FLICKER — no calcular
 *     sumas hasta que esten todas, evita el "salto" visible de los valores
 *     en el Benchmark al ir llegando los settlements uno por uno (1 fetch
 *     por vencido — con 16 vencidos = 16 actualizaciones de state).
 */
import { useEffect, useMemo, useState } from 'react';
import { getNdfSettlement, type NdfSettlementResult } from 'src/models/pricing/pricingApi';
import type { NdfPosition } from 'src/types/trading';

export type SettlementsMap = Record<string, NdfSettlementResult | 'error'>;

export interface UseNdfSettlementsResult {
  map: SettlementsMap;
  /** true cuando todas las entradas esperadas (NDFs con maturity < hoy) tienen entrada. */
  allLoaded: boolean;
  /** Conteos para diagnostico/loaders. */
  expectedCount: number;
  resolvedCount: number;
}

export function useNdfSettlements(positions: NdfPosition[]): UseNdfSettlementsResult {
  const [map, setMap] = useState<SettlementsMap>({});

  // Lista de NDFs vencidos (los que esperamos settlement de).
  const expiredIds = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return positions
      .filter((p) => p.maturity_date < today)
      .map((p) => p.id);
  }, [positions]);

  useEffect(() => {
    if (expiredIds.length === 0) return;
    const expired = positions.filter((p) => expiredIds.includes(p.id));
    expired.forEach((p) => {
      if (map[p.id] !== undefined) return;
      getNdfSettlement({
        notional_usd: p.notional_usd,
        strike: p.strike,
        maturity_date: p.maturity_date,
        direction: p.direction as 'buy' | 'sell',
      })
        .then((result) => {
          setMap((prev) => ({ ...prev, [p.id]: result }));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn(`[settlement] NDF ${p.id} (${p.maturity_date}):`, err?.message ?? err);
          setMap((prev) => ({ ...prev, [p.id]: 'error' }));
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredIds]);

  // Eager reset si cambio drasticamente la lista (cambio de empresa) —
  // libera memoria y evita usar entradas de otra empresa.
  useEffect(() => {
    if (Object.keys(map).length === 0) return;
    const currentIds = new Set(positions.map((p) => p.id));
    const hasOverlap = Object.keys(map).some((id) => currentIds.has(id));
    if (!hasOverlap) setMap({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const resolvedCount = useMemo(
    () => expiredIds.reduce((c, id) => (map[id] !== undefined ? c + 1 : c), 0),
    [map, expiredIds],
  );

  // allLoaded = no hay vencidos, o todos resueltos.
  const allLoaded = expiredIds.length === 0 || resolvedCount >= expiredIds.length;

  return {
    map,
    allLoaded,
    expectedCount: expiredIds.length,
    resolvedCount,
  };
}
