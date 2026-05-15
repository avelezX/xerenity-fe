/**
 * USDCOP Calculator — calcula TRM spot + vol rolling 180d desde `market_marks`.
 *
 * Antes: llamaba al endpoint Django `/usdcop_calculator` que leia de
 * `banrep_series_value_v2`. Ahora calcula 100% en el frontend leyendo de
 * `xerenity.market_marks.fx_spot` (misma fuente que OTC pricing).
 *
 * Esto garantiza consistencia con el resto del modulo de Riesgos y con
 * el portafolio OTC — siempre el mismo TRM EOD.
 */
import { fetchFxSpotSeries } from 'src/lib/risk/marketMarks';

const TRADING_DAYS = 252;
const VOL_WINDOW = 180;
const FETCH_DAYS_BACK = 400; // ~13 meses de calendario para tener 180 dias habiles

export interface UsdCopData {
  trm: number;
  vol_diaria: number;
  vol_anual: number;
  fecha: string;
}

/**
 * Calcula TRM y vol rolling 180d a partir de `market_marks.fx_spot`.
 *
 * @param asOfDate (opcional) fecha de referencia "YYYY-MM-DD". Si se omite
 *   usa hoy. Util para que el calculador se sincronice con el selector
 *   global de fecha del modulo de Riesgos.
 */
export async function fetchUsdCopCalculator(asOfDate?: string): Promise<UsdCopData> {
  const end = asOfDate ?? new Date().toISOString().slice(0, 10);
  const endDate = new Date(`${end}T12:00:00Z`);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - FETCH_DAYS_BACK);
  const start = startDate.toISOString().slice(0, 10);

  const series = await fetchFxSpotSeries(start, end);
  if (series.length < 2) {
    throw new Error('Datos insuficientes de market_marks.fx_spot para calcular retornos');
  }

  // Log returns: r_t = ln(p_t / p_{t-1})
  const logReturns: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1].fx_spot;
    const curr = series[i].fx_spot;
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  // Ventana rolling 180d (ultimos N returns)
  const window = logReturns.slice(-VOL_WINDOW);
  if (window.length < 30) {
    throw new Error(`Datos insuficientes para vol rolling: ${window.length} retornos (min 30)`);
  }

  // Desviacion estandar muestral (n-1, mismo que pandas .std() default)
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / (window.length - 1);
  const volDiaria = Math.sqrt(variance);
  const volAnual = volDiaria * Math.sqrt(TRADING_DAYS);

  const latest = series[series.length - 1];

  return {
    trm: latest.fx_spot,
    vol_diaria: volDiaria,
    vol_anual: volAnual,
    fecha: latest.fecha,
  };
}
