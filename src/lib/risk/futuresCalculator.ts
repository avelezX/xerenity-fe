/* eslint-disable no-plusplus, no-continue, no-restricted-syntax, prefer-template */
/**
 * Futures portfolio calculator — TypeScript port of gestion_de_riesgos/futures_portfolio.py
 *
 * Calculates P&L per position (inception and monthly) with contract multipliers.
 */

import type { FuturesPosition } from 'src/types/risk';
import type { FuturesPositionRow } from './supabaseRisk';
import type { CommodityConfig } from './companyConfig';

// ── Constants ──

// Fallback multipliers (used when no company config is available)
const DEFAULT_MULTIPLIERS: Record<string, number> = {
  MAIZ: 5_000,
  AZUCAR: 112_000,
  CACAO: 10,
};

const DIRECTION_SIGN: Record<string, number> = {
  LONG: 1,
  SHORT: -1,
};

const DEFAULT_PRICE_UNITS: Record<string, string> = {
  MAIZ: 'cents/bu',
  AZUCAR: 'cents/lb',
  CACAO: 'USD/ton',
};

// Price-to-USD conversion: cents → dollars (divide by 100)
const PRICE_TO_USD: Record<string, number> = {
  MAIZ: 0.01,     // cents/bu → USD/bu
  AZUCAR: 0.01,   // cents/lb → USD/lb
  CACAO: 1,        // USD/ton → USD/ton (no conversion)
};

// ── Helpers ──

/**
 * Parse a futures contract code (e.g. ZCN26, SBV27) into its expiry month/year.
 * Returns a short label like "Jul 26" or "Oct 27", or null if the code is malformed.
 *
 * Month codes (CME/CBOT/ICE convention):
 *   F=Jan G=Feb H=Mar J=Apr K=May M=Jun N=Jul Q=Aug U=Sep V=Oct X=Nov Z=Dec
 *
 * Soporta dos formatos de año:
 *   - 2 digitos: ZCN26 → "Jul 26"
 *   - 1 digito:  ZCN6  → "Jul 26" (el collector ocasionalmente guarda asi;
 *     asumimos decada actual 202X)
 */
const FUTURES_MONTH_CODES: Record<string, string> = {
  F: 'Jan', G: 'Feb', H: 'Mar', J: 'Apr', K: 'May', M: 'Jun',
  N: 'Jul', Q: 'Aug', U: 'Sep', V: 'Oct', X: 'Nov', Z: 'Dec',
};

export function parseContractMaturity(contract: string | null | undefined): string | null {
  if (!contract) return null;
  // Format: <ROOT 1-3 letters><MONTH 1 letter><YEAR 1-2 digits>
  const match = contract.match(/^([A-Z]{1,3})([FGHJKMNQUVXZ])(\d{1,2})$/);
  if (!match) return null;
  const month = FUTURES_MONTH_CODES[match[2]];
  if (!month) return null;
  const year = match[3].length === 1 ? `2${match[3]}` : match[3];
  return `${month} ${year}`;
}

/**
 * Last business day of the previous month (skip weekends).
 */
export function lastBusinessDayOfPrevMonth(refDate: Date): Date {
  const firstOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const lastCalDay = new Date(firstOfMonth.getTime() - 86400000); // day before = last of prev month
  const wd = lastCalDay.getDay(); // 0=Sun, 6=Sat
  if (wd === 0) lastCalDay.setDate(lastCalDay.getDate() - 2); // Sun → Fri
  else if (wd === 6) lastCalDay.setDate(lastCalDay.getDate() - 1); // Sat → Fri
  return lastCalDay;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Find the last available price for an asset on or before targetDate.
 */
function findPrice(
  dates: string[],
  assetPrices: (number | null)[],
  targetDate: string,
): { price: number | null; date: string | null } {
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= targetDate && assetPrices[i] != null) {
      return { price: assetPrices[i], date: dates[i] };
    }
  }
  return { price: null, date: null };
}

// ── Main Calculator ──

export function calculateFuturesPortfolio(
  positions: FuturesPositionRow[],
  dates: string[],
  prices: Record<string, (number | null)[]>,
  filterDate: string,
  commodityConfig?: CommodityConfig[],
  // Per-contract prices from risk_prices_all_contracts. Si esta presente,
  // se usa para cada posicion (lookup por pos.contract). Si el contrato no
  // tiene datos en pricesByContract, cae al front contract de `prices` (el
  // comportamiento legacy donde todos los contratos del activo tomaban el
  // mismo precio).
  pricesByContract?: Record<string, (number | null)[]>,
  contractDates?: string[],
): FuturesPosition[] {
  // Build multipliers and price units from config or use defaults
  const multipliers: Record<string, number> = { ...DEFAULT_MULTIPLIERS };
  const priceUnits: Record<string, string> = { ...DEFAULT_PRICE_UNITS };
  if (commodityConfig) {
    commodityConfig.forEach((c) => {
      multipliers[c.asset] = c.contract_multiplier;
      priceUnits[c.asset] = c.price_unit;
    });
  }
  const refDate = new Date(filterDate + 'T12:00:00');
  const prevMonthLastBD = lastBusinessDayOfPrevMonth(refDate);
  const prevMonthStr = toDateStr(prevMonthLastBD);

  // Filter positions: only those opened on or before the selected filter date
  // (same logic as Benchmark — don't show positions that didn't exist yet)
  const filteredPositions = positions.filter((p) =>
    p.entry_date != null && p.entry_date !== '' && p.entry_date <= filterDate,
  );

  const result: FuturesPosition[] = [];

  let totalValorT = 0;
  let totalValorT1 = 0;
  let totalPnlMonth = 0;
  let totalPnlInception = 0;

  for (const pos of filteredPositions) {
    const multiplier = multipliers[pos.asset] ?? 1;
    const dirSign = DIRECTION_SIGN[pos.direction] ?? 1;

    // Series de precios para ESTE contrato.
    // Prioridad:
    //   1. risk_prices_all_contracts → pricesByContract[pos.contract] (precio
    //      especifico del contrato — lo correcto para mark-to-market).
    //   2. Fallback: front contract de risk_prices → prices[pos.asset] (puede
    //      dar resultados incorrectos cuando hay multiples contratos abiertos
    //      del mismo activo, pero es mejor que mostrar nada).
    const contractPrices = pos.contract && pricesByContract
      ? pricesByContract[pos.contract]
      : undefined;
    const useContractSeries = contractPrices != null && (contractDates?.length ?? 0) > 0;
    const seriesDates = useContractSeries ? contractDates! : dates;
    const seriesPrices = useContractSeries ? contractPrices! : prices[pos.asset];

    if (!seriesPrices) continue;

    // Current price: last available on or before filterDate
    const current = findPrice(seriesDates, seriesPrices, filterDate);

    // Precio previo logic:
    // If position opened in the current month → use entry_price
    // If older → use last business day of previous month's price
    const entryMonth = pos.entry_date.slice(0, 7); // "YYYY-MM"
    const filterMonth = filterDate.slice(0, 7);

    let precioPrevio: number | null;
    let precioPrevioDate: string | null;

    if (entryMonth === filterMonth) {
      // Opened this month — previo = entry price
      precioPrevio = pos.entry_price;
      precioPrevioDate = pos.entry_date;
    } else {
      // Older position — previo = last BD of prev month
      const prev = findPrice(seriesDates, seriesPrices, prevMonthStr);
      precioPrevio = prev.price;
      precioPrevioDate = prev.date;
    }

    const currentPrice = current.price;
    const entryPrice = pos.entry_price;
    // Convert cents to USD for assets quoted in cents (MAIZ, AZUCAR)
    const toUsd = PRICE_TO_USD[pos.asset] ?? 1;

    // Calculations — all values in USD
    const valorT = currentPrice != null ? pos.nominal * multiplier * currentPrice * toUsd : null;
    const valorT1 = precioPrevio != null ? pos.nominal * multiplier * precioPrevio * toUsd : null;

    const pnlInception =
      currentPrice != null
        ? (currentPrice - entryPrice) * pos.nominal * multiplier * dirSign * toUsd
        : null;

    const pnlMonth =
      currentPrice != null && precioPrevio != null
        ? (currentPrice - precioPrevio) * pos.nominal * multiplier * dirSign * toUsd
        : null;

    if (valorT != null) totalValorT += valorT;
    if (valorT1 != null) totalValorT1 += valorT1;
    if (pnlMonth != null) totalPnlMonth += pnlMonth;
    if (pnlInception != null) totalPnlInception += pnlInception;

    result.push({
      id: pos.id,
      asset: pos.asset,
      contract: pos.contract,
      direction: pos.direction,
      nominal: pos.nominal,
      multiplier,
      entry_price: entryPrice,
      entry_date: pos.entry_date,
      current_price: currentPrice,
      current_price_date: current.date,
      precio_previo: precioPrevio,
      precio_previo_date: precioPrevioDate,
      valor_t: valorT != null ? Math.round(valorT) : null,
      valor_t1: valorT1 != null ? Math.round(valorT1) : null,
      pnl_inception: pnlInception != null ? Math.round(pnlInception) : null,
      pnl_month: pnlMonth != null ? Math.round(pnlMonth) : null,
      price_unit: priceUnits[pos.asset] ?? '',
      active: pos.active,
      closed_date: pos.closed_date,
      closed_price: pos.closed_price,
      rolled_to: pos.rolled_to,
      portfolio_id: pos.portfolio_id,
    });
  }

  // Group by asset for subtotals
  const assetGroups = new Map<string, { nominal: number; valorT: number; valorT1: number; pnlMonth: number; pnlInception: number; valorCompra: number }>();
  let totalNominal = 0;

  for (const pos of result) {
    const group = assetGroups.get(pos.asset) ?? { nominal: 0, valorT: 0, valorT1: 0, pnlMonth: 0, pnlInception: 0, valorCompra: 0 };
    group.nominal += pos.nominal ?? 0;
    group.valorT += pos.valor_t ?? 0;
    group.valorT1 += pos.valor_t1 ?? 0;
    group.pnlMonth += pos.pnl_month ?? 0;
    group.pnlInception += pos.pnl_inception ?? 0;
    const toUsdFactor = PRICE_TO_USD[pos.asset] ?? 1;
    group.valorCompra += (pos.entry_price ?? 0) * (pos.multiplier ?? 1) * (pos.nominal ?? 0) * toUsdFactor;
    assetGroups.set(pos.asset, group);
    totalNominal += pos.nominal ?? 0;
  }

  // Sort result: group positions by asset, then add subtotal after each group
  const sorted: FuturesPosition[] = [];
  const assets = Array.from(assetGroups.keys()).sort();
  for (const asset of assets) {
    const assetPositions = result.filter((p) => p.asset === asset);
    sorted.push(...assetPositions);
    const group = assetGroups.get(asset)!;
    // Subtotal row per asset
    sorted.push({
      id: `subtotal-${asset}`,
      asset: `Total ${asset}`,
      contract: '',
      direction: '' as 'LONG',
      nominal: group.nominal,
      multiplier: 0,
      entry_price: 0,
      entry_date: '',
      current_price: null,
      current_price_date: null,
      precio_previo: null,
      precio_previo_date: null,
      valor_t: Math.round(group.valorT),
      valor_t1: Math.round(group.valorT1),
      pnl_inception: Math.round(group.pnlInception),
      pnl_month: Math.round(group.pnlMonth),
      price_unit: '',
      active: true,
      closed_date: null,
      closed_price: null,
      rolled_to: null,
    });
  }

  // Grand total row
  sorted.push({
    id: '',
    asset: 'Total',
    contract: '',
    direction: '' as 'LONG',
    nominal: totalNominal,
    multiplier: 0,
    entry_price: 0,
    entry_date: '',
    current_price: null,
    current_price_date: null,
    precio_previo: null,
    precio_previo_date: null,
    valor_t: Math.round(totalValorT),
    valor_t1: Math.round(totalValorT1),
    pnl_inception: Math.round(totalPnlInception),
    pnl_month: Math.round(totalPnlMonth),
    price_unit: '',
    active: true,
    closed_date: null,
    closed_price: null,
    rolled_to: null,
  });

  return sorted;
}

/**
 * Execute a roll: returns close update + new position record.
 */
export function executeRoll(
  oldPosition: FuturesPositionRow,
  newContract: string,
  rollPrice: number,
  rollDate: string,
  newEntryPrice?: number,
): { closeUpdate: Record<string, unknown>; newPosition: Partial<FuturesPositionRow> } {
  return {
    closeUpdate: {
      active: false,
      closed_date: rollDate,
      closed_price: rollPrice,
      rolled_to: newContract,
    },
    newPosition: {
      asset: oldPosition.asset,
      contract: newContract,
      direction: oldPosition.direction,
      nominal: oldPosition.nominal,
      entry_price: newEntryPrice ?? rollPrice,
      entry_date: rollDate,
      active: true,
      company_id: oldPosition.company_id,
    },
  };
}
