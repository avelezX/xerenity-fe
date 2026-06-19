/**
 * Reconstrucción histórica de posiciones NDF para vista "as-of".
 *
 * Cuando el usuario selecciona un mes pasado (e.g. mayo 2026), queremos que
 * el portafolio se vea como era ese día — incluyendo NDFs que se liquidaron
 * después. La tabla `trading.ndf_position` MUTA el `notional_usd` al
 * liquidar (lo reduce o lo pone en 0), pero `trading.ndf_liquidation`
 * preserva el audit trail con `monto_liquidado_usd`.
 *
 * Reconstruccion:
 *   notional_at(p, D) = current_notional + Σ monto_liquidado donde
 *                       ndf_position_id = p.id AND liquidation_date > D
 *
 * Casos:
 *   - Sin liquidaciones después de D → notional sin cambio.
 *   - Total liquidado en jun por 500K, mirando mayo: 0 + 500K = 500K ✓
 *   - Parcial 200K en jun + 200K en jul (current=100K), mirando mayo:
 *     100K + 200K + 200K = 500K ✓
 *   - Lo mismo mirando jul: 100K + 0 = 100K ✓
 */
/* eslint-disable no-continue */
import type { NdfPosition } from 'src/types/trading';
import type { NdfSettlementResult } from 'src/models/pricing/pricingApi';
import type { NdfLiquidationRow } from 'src/models/trading';

/**
 * Notional reconstruido para una sola posicion at-of-date.
 * Inlineable; sin allocations cuando no hay liquidaciones para reverter.
 */
export function reconstructNdfNotionalAt(
  position: Pick<NdfPosition, 'id' | 'notional_usd'>,
  liquidations: NdfLiquidationRow[],
  asOfDate: string,
): number {
  if (!liquidations || liquidations.length === 0) return position.notional_usd;
  let undone = 0;
  for (let i = 0; i < liquidations.length; i += 1) {
    const l = liquidations[i];
    if (l.ndf_position_id === position.id && l.liquidation_date > asOfDate) {
      undone += Number(l.monto_liquidado_usd) || 0;
    }
  }
  return position.notional_usd + undone;
}

/**
 * Devuelve la lista de NDFs con `notional_usd` reconstruido para `asOfDate`.
 * Las posiciones con `trade_date > asOfDate` NO se excluyen aqui (eso lo
 * hace el hook de reprice mas adelante). Solo ajustamos el notional.
 */
export function reconstructNdfPositionsAsOf(
  positions: NdfPosition[],
  liquidations: NdfLiquidationRow[],
  asOfDate: string,
): NdfPosition[] {
  if (!liquidations || liquidations.length === 0) return positions;
  return positions.map((p) => {
    const n = reconstructNdfNotionalAt(p, liquidations, asOfDate);
    return n === p.notional_usd ? p : { ...p, notional_usd: n };
  });
}

/**
 * "Estado as-of": para una fecha D, derivar como aparecia la posicion ese dia.
 *
 *   - trade_date > D → no existia (se filtra antes del display)
 *   - reconstructed_notional > 0 y maturity_date >= D → 'Activo'
 *   - reconstructed_notional == 0 → ya estaba 'Liquidado' (rare; significa
 *     que se liquido antes de D pero la posicion sigue en la tabla)
 *
 * Notar: 'Vencido' lo determina el reprice por maturity_date < valuation_date.
 * No interferimos con esa logica.
 */
export function estadoAsOf(
  position: Pick<NdfPosition, 'id' | 'notional_usd' | 'trade_date' | 'maturity_date'>,
  liquidations: NdfLiquidationRow[],
  asOfDate: string,
): 'Activo' | 'Liquidado' | 'Vencido' | 'Inexistente' {
  if (position.trade_date && position.trade_date > asOfDate) return 'Inexistente';
  const n = reconstructNdfNotionalAt(position, liquidations, asOfDate);
  if (n === 0) return 'Liquidado';
  if (position.maturity_date && position.maturity_date < asOfDate) return 'Vencido';
  return 'Activo';
}

/**
 * Filtra liquidaciones a las que efectivamente ocurrieron en o antes de `asOfDate`.
 * Util para el tab Liquidado del blotter y para el card P&G Realizado.
 */
export function filterLiquidationsAsOf(
  liquidations: NdfLiquidationRow[],
  asOfDate: string,
): NdfLiquidationRow[] {
  if (!liquidations || liquidations.length === 0) return liquidations ?? [];
  return liquidations.filter((l) => l.liquidation_date <= asOfDate);
}

/**
 * Suma realized_pnl_cop / usd de las liquidaciones cuyo mes calendario
 * coincide con `yearMonth` ("YYYY-MM"). Usado por Benchmark / Resumen.
 */
export function sumLiquidationsInMonth(
  liquidations: NdfLiquidationRow[],
  yearMonth: string,
): { cop: number; usd: number; count: number } {
  if (!liquidations || liquidations.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < liquidations.length; i += 1) {
    const l = liquidations[i];
    if (l.liquidation_date.slice(0, 7) === yearMonth) {
      cop += Number(l.realized_pnl_cop) || 0;
      usd += Number(l.realized_pnl_usd) || 0;
      count += 1;
    }
  }
  return { cop, usd, count };
}

/**
 * Suma liquidaciones en un rango de fechas (ambos inclusive).
 * Usado para P&G Realizado MTD y YTD del SummaryBar de /portfolio.
 */
export function sumLiquidationsBetween(
  liquidations: NdfLiquidationRow[],
  startDate: string,
  endDate: string,
): { cop: number; usd: number; count: number } {
  if (!liquidations || liquidations.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < liquidations.length; i += 1) {
    const l = liquidations[i];
    if (l.liquidation_date >= startDate && l.liquidation_date <= endDate) {
      cop += Number(l.realized_pnl_cop) || 0;
      usd += Number(l.realized_pnl_usd) || 0;
      count += 1;
    }
  }
  return { cop, usd, count };
}

// ───────────────────────────────────────────────────────────────────
// Settlement P&L de NDFs vencidos naturalmente (BanRep TRM al maturity)
// Usados para complementar el P&G Realizado y el Benchmark USD row.
//
// IMPORTANTE: nunca contar un mismo NDF dos veces. Si fue liquidado
// manualmente (existe una row en ndf_liquidation con su id), saltamos
// el settlement automatico — el realized "real" es la liquidacion.
// ───────────────────────────────────────────────────────────────────

type SettlementEntry = NdfSettlementResult | 'error';
type SettlementsMap = Record<string, SettlementEntry>;

const isValidSettlement = (s: SettlementEntry | undefined): s is NdfSettlementResult =>
  !!s && s !== 'error';

/**
 * Suma pyl_cop / pyl_usd de NDFs vencidos as-of la fecha dada (cumulativo).
 *
 * Filtros aplicados:
 *   1. maturity_date <= asOfDate (el NDF ya vencio para esa fecha)
 *   2. Settlement valido (no 'error' ni undefined)
 *   3. NDF NO tiene liquidacion manual (evita doble conteo)
 *
 * Usado por el P&G Realizado COP del SummaryBar en /portfolio.
 */
export function sumSettlementsAsOf(
  positions: NdfPosition[],
  settlements: SettlementsMap,
  liquidations: NdfLiquidationRow[],
  asOfDate: string,
): { cop: number; usd: number; count: number } {
  if (!positions || positions.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  // Set de position ids con liquidacion manual — O(1) lookup despues
  const liquidatedIds = new Set(liquidations.map((l) => l.ndf_position_id));
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    if (p.maturity_date > asOfDate) continue;
    if (liquidatedIds.has(p.id)) continue;
    const s = settlements[p.id];
    if (!isValidSettlement(s)) continue;
    cop += Number(s.pyl_cop) || 0;
    usd += Number(s.pyl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}

/**
 * Suma pyl_cop / pyl_usd de NDFs cuyo maturity cae EN el mes (yearMonth = "YYYY-MM").
 * Usado por Benchmark + Resumen — la fila USD pnl_gr suma el realized del mes.
 *
 * Mismos filtros que sumSettlementsAsOf (skip si liquidacion manual existe).
 */
export function sumSettlementsInMonth(
  positions: NdfPosition[],
  settlements: SettlementsMap,
  liquidations: NdfLiquidationRow[],
  yearMonth: string,
): { cop: number; usd: number; count: number } {
  if (!positions || positions.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  const liquidatedIds = new Set(liquidations.map((l) => l.ndf_position_id));
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    if (!p.maturity_date || p.maturity_date.slice(0, 7) !== yearMonth) continue;
    if (liquidatedIds.has(p.id)) continue;
    const s = settlements[p.id];
    if (!isValidSettlement(s)) continue;
    cop += Number(s.pyl_cop) || 0;
    usd += Number(s.pyl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}

/**
 * Suma settlements de NDFs cuyo maturity cae en el rango [startDate, endDate].
 * Skip si tiene liquidacion manual (no doble conteo).
 * Usado para P&G Realizado MTD y YTD del SummaryBar de /portfolio.
 */
export function sumSettlementsBetween(
  positions: NdfPosition[],
  settlements: SettlementsMap,
  liquidations: NdfLiquidationRow[],
  startDate: string,
  endDate: string,
): { cop: number; usd: number; count: number } {
  if (!positions || positions.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  const liquidatedIds = new Set(liquidations.map((l) => l.ndf_position_id));
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    if (!p.maturity_date) continue;
    if (p.maturity_date < startDate || p.maturity_date > endDate) continue;
    if (liquidatedIds.has(p.id)) continue;
    const s = settlements[p.id];
    if (!isValidSettlement(s)) continue;
    cop += Number(s.pyl_cop) || 0;
    usd += Number(s.pyl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}

// ───────────────────────────────────────────────────────────────────
// XCCY settlements — cashflows trimestrales liquidados
// Una fila por (xccy_position_id, period_index). Persistido en
// trading.xccy_settlement por el endpoint /pricing/xccy/settle.
// Cada fila ya tiene el realized_pnl_cop/usd calculado con el TRM
// BanRep al payment_date, asi que aqui solo sumamos por rango/mes.
// ───────────────────────────────────────────────────────────────────

type XccyRow = {
  payment_date: string;
  realized_pnl_cop: number;
  realized_pnl_usd: number;
};

/**
 * Suma realized P&L de cashflows XCCY cuyo payment_date cae en el rango
 * [startDate, endDate] (ambos inclusive). Usado por SummaryBar de
 * /portfolio (P&G MTD COP y P&G YTD COP).
 */
export function sumXccySettlementsBetween(
  settlements: XccyRow[],
  startDate: string,
  endDate: string,
): { cop: number; usd: number; count: number } {
  if (!settlements || settlements.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < settlements.length; i += 1) {
    const r = settlements[i];
    if (!r.payment_date) continue;
    if (r.payment_date < startDate || r.payment_date > endDate) continue;
    cop += Number(r.realized_pnl_cop) || 0;
    usd += Number(r.realized_pnl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}

/**
 * Suma realized P&L de cashflows XCCY cuyo payment_date cae EN el mes
 * (yearMonth = "YYYY-MM"). Usado por Benchmark + Resumen USD row del mes.
 */
export function sumXccySettlementsInMonth(
  settlements: XccyRow[],
  yearMonth: string,
): { cop: number; usd: number; count: number } {
  if (!settlements || settlements.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < settlements.length; i += 1) {
    const r = settlements[i];
    if (!r.payment_date) continue;
    if (r.payment_date.slice(0, 7) !== yearMonth) continue;
    cop += Number(r.realized_pnl_cop) || 0;
    usd += Number(r.realized_pnl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}

/**
 * Suma realized P&L de cashflows XCCY cumulativo hasta `asOfDate` (inclusive).
 * Usado para vista historica del P&G Realizado.
 */
export function sumXccySettlementsAsOf(
  settlements: XccyRow[],
  asOfDate: string,
): { cop: number; usd: number; count: number } {
  if (!settlements || settlements.length === 0) {
    return { cop: 0, usd: 0, count: 0 };
  }
  let cop = 0;
  let usd = 0;
  let count = 0;
  for (let i = 0; i < settlements.length; i += 1) {
    const r = settlements[i];
    if (!r.payment_date) continue;
    if (r.payment_date > asOfDate) continue;
    cop += Number(r.realized_pnl_cop) || 0;
    usd += Number(r.realized_pnl_usd) || 0;
    count += 1;
  }
  return { cop, usd, count };
}
