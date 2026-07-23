/**
 * Inputs de mercado para el pricer de opciones USDCOP.
 *
 * Ancla el pricing a la MISMA fuente EOD que OTC: `xerenity.market_marks`.
 * De una sola fila obtiene todo lo que Black-76 necesita:
 *
 *   - spot     → `fx_spot`
 *   - forward  → interpolación lineal de `ndf[<meses>].F_market` (curva NDF)
 *   - descuento→ interpolación de la curva `ibr` (E.A.) → factor de descuento COP
 *
 * Fallback del forward: si falta la curva NDF, usa paridad cubierta de tasas
 * (CIP) con IBR (COP) y SOFR (USD); si tampoco, cae a spot con warning.
 *
 * Formas reales del JSONB (verificadas contra prod, 2026-07):
 *   ndf:  { "1": {F_market, deval_ea, fwd_pts_cop}, "2": {...}, "3": {...}, ... }
 *   ibr:  { "ibr_1d": 11.19, "ibr_1m": 11.51, "ibr_3m": 11.81, "ibr_12m": 12.54, ... }
 *   sofr: { "1": 3.68, "3": 3.78, "6": 3.90, "12": 4.03, ... }   (meses → % anual)
 *
 * Convención IBR: se asume tasa efectiva anual (E.A.), consistente con la
 * cotización de mercado colombiana. DF = (1 + r_ea)^(−T); el pricer usa la
 * continua equivalente r_cont = ln(1 + r_ea) para descuento/theta/rho.
 */
import { fetchLatestMarketMark } from 'src/lib/risk/marketMarks';
import type { FxOptionMarketInputs } from 'src/types/pricing';

const DAYS_PER_MONTH = 30.4375; // 365.25 / 12

interface NdfNode {
  F_market?: number;
  fwd_pts_cop?: number;
  deval_ea?: number;
}

/** Punto (meses, valor) para interpolar una curva. */
interface CurvePoint {
  months: number;
  value: number;
}

/**
 * Interpola linealmente en `months`. Fuera del rango, clampea al extremo
 * más cercano (flat) y marca `extrapolated = true`.
 */
function interpLinear(
  points: CurvePoint[],
  targetMonths: number,
): { value: number; extrapolated: boolean; nearest: number } {
  const sorted = [...points].sort((a, b) => a.months - b.months);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (targetMonths <= first.months) {
    return {
      value: first.value,
      extrapolated: targetMonths < first.months,
      nearest: first.months,
    };
  }
  if (targetMonths >= last.months) {
    return {
      value: last.value,
      extrapolated: targetMonths > last.months,
      nearest: last.months,
    };
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (targetMonths >= lo.months && targetMonths <= hi.months) {
      const w = (targetMonths - lo.months) / (hi.months - lo.months);
      return {
        value: lo.value + w * (hi.value - lo.value),
        extrapolated: false,
        nearest: w < 0.5 ? lo.months : hi.months,
      };
    }
  }
  return { value: last.value, extrapolated: true, nearest: last.months };
}

/** Convierte una clave IBR (`ibr_1d`, `ibr_3m`, `ibr_2y`) a meses. */
function ibrKeyToMonths(key: string): number | null {
  const m = /ibr_(\d+)([dmy])/i.exec(key);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case 'd':
      return n / DAYS_PER_MONTH;
    case 'm':
      return n;
    case 'y':
      return n * 12;
    default:
      return null;
  }
}

/** Parsea la curva IBR (valores en %) a puntos (meses, decimal E.A.). */
function parseIbrCurve(ibr: Record<string, unknown> | null | undefined): CurvePoint[] {
  if (!ibr) return [];
  const pts: CurvePoint[] = [];
  Object.entries(ibr).forEach(([k, v]) => {
    const months = ibrKeyToMonths(k);
    const val = typeof v === 'number' ? v : Number(v);
    if (months != null && Number.isFinite(val)) {
      pts.push({ months, value: val / 100 });
    }
  });
  return pts;
}

/** Parsea la curva NDF a puntos (meses, F_market). */
function parseNdfForwardCurve(
  ndf: Record<string, unknown> | null | undefined,
): CurvePoint[] {
  if (!ndf) return [];
  const pts: CurvePoint[] = [];
  Object.entries(ndf).forEach(([k, v]) => {
    const months = Number(k);
    const node = v as NdfNode | number | null;
    let f = NaN;
    if (typeof node === 'number') f = node;
    else if (node && typeof node.F_market === 'number') f = node.F_market;
    if (Number.isFinite(months) && Number.isFinite(f)) {
      pts.push({ months, value: f });
    }
  });
  return pts;
}

/** Parsea la curva SOFR (valores en %) a puntos (meses, decimal). */
function parseSofrCurve(sofr: Record<string, unknown> | null | undefined): CurvePoint[] {
  if (!sofr) return [];
  const pts: CurvePoint[] = [];
  Object.entries(sofr).forEach(([k, v]) => {
    const months = Number(k);
    const val = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(months) && Number.isFinite(val)) {
      pts.push({ months, value: val / 100 });
    }
  });
  return pts;
}

/** Suma meses a una fecha ISO y devuelve ISO (YYYY-MM-DD). */
function addMonthsIso(iso: string, months: number): string {
  const base = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const totalDays = Math.round(months * DAYS_PER_MONTH);
  base.setUTCDate(base.getUTCDate() + totalDays);
  return base.toISOString().slice(0, 10);
}

export interface BuildFxOptionInputsParams {
  /** Fecha de valoración ISO (usar `globalEvaluationDate` del store). */
  evalDate: string;
  /** Tenor en meses (1, 2, 3...). Prototipo: banda vol plana hasta 3M. */
  tenorMonths: number;
}

/**
 * Construye los inputs de mercado para pricear una opción USDCOP al tenor dado.
 * Lee el último `market_marks` <= evalDate (carry-forward).
 */
export async function buildFxOptionInputs({
  evalDate,
  tenorMonths,
}: BuildFxOptionInputsParams): Promise<FxOptionMarketInputs> {
  const mark = await fetchLatestMarketMark(evalDate);
  if (!mark) {
    throw new Error(`No hay market_marks disponible <= ${evalDate}`);
  }
  if (mark.fx_spot == null) {
    throw new Error(`market_marks del ${mark.fecha} no tiene fx_spot`);
  }

  const warnings: string[] = [];
  const spot = Number(mark.fx_spot);
  const markDate = String(mark.fecha).slice(0, 10);
  const T = tenorMonths / 12;
  const maturityDate = addMonthsIso(markDate, tenorMonths);

  if (markDate !== evalDate.slice(0, 10)) {
    warnings.push(`Sin mark exacto para ${evalDate.slice(0, 10)}; se usó ${markDate} (carry-forward).`);
  }
  if (tenorMonths > 3) {
    warnings.push('Tenor > 3M: la vol plana del prototipo solo está calibrada hasta 3 meses.');
  }

  // ── Descuento COP desde la curva IBR ──
  const ibrCurve = parseIbrCurve(mark.ibr as Record<string, unknown> | null);
  if (ibrCurve.length === 0) {
    throw new Error(`market_marks del ${markDate} no tiene curva IBR`);
  }
  const ibrInterp = interpLinear(ibrCurve, tenorMonths);
  const rCopEA = ibrInterp.value;
  if (ibrInterp.extrapolated) {
    warnings.push(`IBR extrapolada al tenor ${tenorMonths}M (nodo más cercano ${ibrInterp.nearest}M).`);
  }
  const rCopCont = Math.log(1 + rCopEA);
  const dfCop = (1 + rCopEA) ** -T;

  // ── Forward desde la curva NDF (con fallback CIP → spot) ──
  const ndfCurve = parseNdfForwardCurve(mark.ndf as Record<string, unknown> | null);
  let forward: number;
  let forwardSource: FxOptionMarketInputs['forwardSource'];

  if (ndfCurve.length > 0) {
    const ndfInterp = interpLinear(ndfCurve, tenorMonths);
    forward = ndfInterp.value;
    forwardSource = 'ndf';
    if (ndfInterp.extrapolated) {
      warnings.push(`Forward NDF extrapolado al tenor ${tenorMonths}M (nodo más cercano ${ndfInterp.nearest}M).`);
    }
  } else {
    // Fallback CIP: F = S · (1 + r_cop)^T / (1 + r_usd)^T
    const sofrCurve = parseSofrCurve(mark.sofr as Record<string, unknown> | null);
    if (sofrCurve.length > 0) {
      const rUsd = interpLinear(sofrCurve, tenorMonths).value;
      forward = spot * ((1 + rCopEA) ** T / (1 + rUsd) ** T);
      forwardSource = 'cip';
      warnings.push('Sin curva NDF: forward estimado por paridad cubierta de tasas (IBR/SOFR).');
    } else {
      forward = spot;
      forwardSource = 'spot';
      warnings.push('Sin curva NDF ni SOFR: forward = spot (sin puntos forward).');
    }
  }

  return {
    evalDate: evalDate.slice(0, 10),
    markDate,
    tenorMonths,
    maturityDate,
    T,
    spot,
    forward,
    fwdPointsCop: forward - spot,
    rCopEA,
    rCopCont,
    dfCop,
    forwardSource,
    warnings,
  };
}
