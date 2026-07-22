/**
 * Pricer de opciones vanilla FX (USDCOP) — prototipo.
 *
 * Modelo: Garman-Kohlhagen expresado como **Black-76 sobre el forward**.
 * En lugar de descontar spot con dos tasas (COP doméstica + USD foránea),
 * usamos el forward USDCOP observado de mercado (curva NDF ya parametrizada
 * en Xerenity) y descontamos con la curva COP (IBR). Esto es equivalente a
 * Garman-Kohlhagen bajo paridad cubierta de tasas (CIP), pero se ancla al
 * forward de mercado en vez de recalcularlo, quedando consistente con el
 * NDF pricer.
 *
 *   Call = DF_cop · [ F·N(d1) − K·N(d2) ]
 *   Put  = DF_cop · [ K·N(−d2) − F·N(−d1) ]
 *   d1 = [ ln(F/K) + ½σ²T ] / (σ√T),   d2 = d1 − σ√T
 *
 * Convenciones (prototipo):
 *  - Vol plana bid/offer (ej. 12%/14%); el caller llama dos veces.
 *  - `sigma`, `rCop` en decimal (0.13 = 13%). `T` en años (act/365).
 *  - Premium se retorna en **COP por 1 USD de nocional** (= pips COP).
 *  - Griegas espontáneas (delta/gamma) requieren spot para convertir la
 *    sensibilidad del forward a sensibilidad del spot vía q = F/S.
 *  - `rho` mide solo el efecto de descuento (F se toma fijo de mercado),
 *    consistente con pricear sobre el forward observado.
 *
 * Sin dependencias — closed-form puro, ~microsegundos. Se llama en el FE.
 */

export type FxOptionType = 'call' | 'put';

export interface FxOptionInput {
  /** Tipo de opción. */
  type: FxOptionType;
  /** Forward USDCOP al vencimiento (COP por USD). */
  F: number;
  /** Strike (COP por USD). */
  K: number;
  /** Tiempo a vencimiento en años (act/365). */
  T: number;
  /** Volatilidad implícita anualizada, decimal (0.13 = 13%). */
  sigma: number;
  /** Tasa COP continua para descuento, decimal. DF_cop = exp(−rCop·T). */
  rCop: number;
  /** Spot USDCOP (COP por USD). Requerido para delta/gamma spot. */
  spot: number;
}

export interface FxOptionGreeks {
  /** ∂Premium/∂Spot (spot delta), COP de prima por 1 COP de spot, por 1 USD nocional. */
  delta: number;
  /** ∂²Premium/∂Spot², por 1 USD nocional. */
  gamma: number;
  /** ∂Premium/∂σ por **1% de vol** (COP), por 1 USD nocional. */
  vega: number;
  /** ∂Premium/∂t por **día calendario** (COP), por 1 USD nocional. Signo: negativo = decae. */
  theta: number;
  /** ∂Premium/∂rCop por **1% de tasa** (COP), por 1 USD nocional. */
  rho: number;
}

export interface FxOptionResult {
  /** Prima en COP por 1 USD de nocional (= pips COP). */
  premiumCop: number;
  /** Valor intrínseco descontado (COP por USD), para referencia. */
  intrinsicCop: number;
  /** Valor temporal = premiumCop − intrinsicCop. */
  timeValueCop: number;
  d1: number;
  d2: number;
  /** Factor de descuento COP usado, exp(−rCop·T). */
  dfCop: number;
  greeks: FxOptionGreeks;
}

const INV_SQRT_2PI = 0.3989422804014327; // 1/√(2π)

/** Densidad normal estándar φ(x). */
export function normPdf(x: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * x * x);
}

/**
 * Función de distribución acumulada normal estándar Φ(x).
 * Aproximación Zelen & Severo (A&S 26.2.17), error < 7.5e-8.
 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t *
    (0.319381530 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = normPdf(x) * poly;
  return x >= 0 ? 1 - p : p;
}

/**
 * Pricea una opción vanilla FX (USDCOP) por Black-76 sobre el forward.
 * Retorna prima (COP por USD nocional) y griegas.
 */
export function priceFxOption(input: FxOptionInput): FxOptionResult {
  const { type, F, K, T, sigma, rCop, spot } = input;
  const isCall = type === 'call';
  const dfCop = Math.exp(-rCop * T);

  // Payoff a vencimiento (sin valor temporal), descontado.
  const intrinsicFwd = isCall ? Math.max(F - K, 0) : Math.max(K - F, 0);
  const intrinsicCop = dfCop * intrinsicFwd;

  // Casos degenerados: sin tiempo o sin vol → solo intrínseco, griegas nulas.
  if (T <= 0 || sigma <= 0 || F <= 0 || K <= 0) {
    let dfF = 0;
    if (isCall && F > K) dfF = 1;
    else if (!isCall && F < K) dfF = -1;
    const q = spot > 0 ? F / spot : 0;
    return {
      premiumCop: intrinsicCop,
      intrinsicCop,
      timeValueCop: 0,
      d1: NaN,
      d2: NaN,
      dfCop,
      greeks: {
        delta: dfCop * dfF * q,
        gamma: 0,
        vega: 0,
        theta: 0,
        rho: -T * intrinsicCop * 0.01,
      },
    };
  }

  const sqrtT = Math.sqrt(T);
  const volSqrtT = sigma * sqrtT;
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / volSqrtT;
  const d2 = d1 - volSqrtT;

  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const nd1 = normPdf(d1); // φ(d1); nótese F·φ(d1) = K·φ(d2)

  const premiumCop = isCall
    ? dfCop * (F * Nd1 - K * Nd2)
    : dfCop * (K * normCdf(-d2) - F * normCdf(-d1));

  // q = F/S: convierte sensibilidad respecto al forward → respecto al spot
  // (F ∝ S bajo puntos forward fijos, dF/dS = F/S).
  const q = spot > 0 ? F / spot : 1;

  // Delta spot: ∂P/∂F · dF/dS
  const dPremiumDf = isCall ? dfCop * Nd1 : -dfCop * normCdf(-d1);
  const delta = dPremiumDf * q;

  // Gamma spot: ∂²P/∂F² · (dF/dS)²
  const gammaFwd = (dfCop * nd1) / (F * volSqrtT);
  const gamma = gammaFwd * q * q;

  // Vega: ∂P/∂σ = DF · F · φ(d1) · √T  (igual call/put). Por 1% de vol → ×0.01.
  const vega = dfCop * F * nd1 * sqrtT * 0.01;

  // Theta (por año): θ = rCop·P − DF·F·φ(d1)·σ/(2√T). Por día → /365.
  const thetaYear = rCop * premiumCop - (dfCop * F * nd1 * sigma) / (2 * sqrtT);
  const theta = thetaYear / 365;

  // Rho: F fijo de mercado, solo mueve el descuento → ∂P/∂r = −T·P. Por 1% → ×0.01.
  const rho = -T * premiumCop * 0.01;

  return {
    premiumCop,
    intrinsicCop,
    timeValueCop: premiumCop - intrinsicCop,
    d1,
    d2,
    dfCop,
    greeks: { delta, gamma, vega, theta, rho },
  };
}
