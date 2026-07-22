import type { CashPosition, PricedCash } from 'src/types/trading';

/**
 * Valoración client-side de operaciones CASH (exposición spot USD/COP).
 * No usa pysdk ni curvas: el CASH es spot puro (sin forward points ni descuento).
 *
 * Convenciones:
 *  - direction 'asset'      → largo USD  (signo +1): si el dólar sube, gana.
 *  - direction 'obligation' → corto USD (signo −1): si el dólar baja, gana
 *    (utilidad contable del pasivo en dólares).
 *  - Abierta (active): marca contra `spotTrm` → P&L vivo.
 *  - Cerrada:          marca contra `closed_price` → P&L materializado, sin
 *    exposición remanente.
 */
export function cashSign(direction: string): number {
  return direction === 'asset' ? 1 : -1;
}

export function priceCashPosition(p: CashPosition, spotTrm: number | null): PricedCash {
  const sign = cashSign(p.direction);
  const closed = !p.active;
  // TRM de valoración: cierre si está cerrada, spot si está abierta.
  const rate = closed ? (p.closed_price ?? p.entry_rate) : (spotTrm ?? p.entry_rate);
  const pnlCop = sign * p.notional_usd * (rate - p.entry_rate);
  const pnlUsd = rate !== 0 ? pnlCop / rate : 0;
  // La exposición sólo existe mientras está abierta; al cerrar queda en 0.
  const exposure = closed ? 0 : sign * p.notional_usd;
  return {
    ...p,
    rate,
    pnl_cop: pnlCop,
    pnl_usd: pnlUsd,
    npv_cop: pnlCop,
    npv_usd: pnlUsd,
    fx_delta: exposure,
    fx_exposure_usd: exposure,
    realized: closed,
    error: (!closed && spotTrm == null) ? 'Sin TRM spot para valorar' : undefined,
  };
}

export function priceCashPositions(
  positions: CashPosition[],
  spotTrm: number | null,
): PricedCash[] {
  return positions.map((p) => priceCashPosition(p, spotTrm));
}
