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
import type { NdfPosition } from 'src/types/trading';
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
