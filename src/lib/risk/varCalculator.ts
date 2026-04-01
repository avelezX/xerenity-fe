/* eslint-disable no-plusplus, no-continue, no-restricted-syntax, no-restricted-globals, @typescript-eslint/no-use-before-define */
/**
 * VaR (Value at Risk) calculator — TypeScript port of var_engine/var_calculator.py
 *
 * Parametric VaR using variance-covariance method:
 *   - Log returns
 *   - Rolling volatility (180-day window, min 30 observations)
 *   - Z-score lookup (no external library needed)
 */

// Z-scores for common confidence levels (from scipy.stats.norm.ppf)
const Z_SCORES: Record<number, number> = {
  0.90: 1.2816,
  0.95: 1.6449,
  0.99: 2.3263,
};

export function getZScore(confidence: number): number {
  return Z_SCORES[confidence] ?? 2.3263; // default 99%
}

/**
 * Calculate log returns: ln(price[t] / price[t-1])
 * Skips nulls — returns null where price or previous price is missing.
 */
export function calculateLogReturns(prices: (number | null)[]): (number | null)[] {
  const returns: (number | null)[] = [null]; // first element has no return
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev != null && curr != null && prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    } else {
      returns.push(null);
    }
  }
  return returns;
}

/**
 * Calculate standard deviation of non-null values.
 * Returns null if fewer than minPeriods non-null values.
 */
function stdDev(values: (number | null)[], minPeriods = 30): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < minPeriods) return null;

  const n = valid.length;
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const variance = valid.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate rolling standard deviation over a window.
 * Each output[i] = std(returns[i-window+1 ... i]) with at least minPeriods non-null values.
 */
export function calculateRollingStd(
  returns: (number | null)[],
  window = 180,
  minPeriods = 30,
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < returns.length; i++) {
    if (i < minPeriods - 1) {
      result.push(null);
      continue;
    }
    const start = Math.max(0, i - window + 1);
    const windowSlice = returns.slice(start, i + 1);
    result.push(stdDev(windowSlice, minPeriods));
  }
  return result;
}

/**
 * Calculate VaR factors for multiple assets.
 * Returns rolling VaR factor (z_score × volatility) per date per asset.
 */
export function calculateVarSeries(
  prices: Record<string, (number | null)[]>,
  window = 180,
  confidence = 0.99,
): {
  varFactors: Record<string, (number | null)[]>;
  returns: Record<string, (number | null)[]>;
} {
  const z = getZScore(confidence);
  const varFactors: Record<string, (number | null)[]> = {};
  const allReturns: Record<string, (number | null)[]> = {};

  for (const [asset, assetPrices] of Object.entries(prices)) {
    const rets = calculateLogReturns(assetPrices);
    allReturns[asset] = rets;
    const rollingVol = calculateRollingStd(rets, window);
    varFactors[asset] = rollingVol.map((vol) => (vol != null ? vol * z : null));
  }

  return { varFactors, returns: allReturns };
}

/**
 * Get the latest (last non-null) VaR factor per asset as a percentage.
 */
export function getLatestVarFactors(
  varFactors: Record<string, (number | null)[]>,
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [asset, factors] of Object.entries(varFactors)) {
    let last: number | null = null;
    for (let i = factors.length - 1; i >= 0; i--) {
      if (factors[i] != null) {
        last = factors[i]! * 100; // as percentage
        break;
      }
    }
    result[asset] = last;
  }
  return result;
}

/**
 * Calculate covariance matrix from returns (pairwise, last `window` observations).
 * Returns { covariance: Record<asset, Record<asset, number>>, correlation: same }
 */
export function calculateMatrices(
  returns: Record<string, (number | null)[]>,
  window = 180,
  minPeriods = 20,
): {
  covariance: Record<string, Record<string, number | null>>;
  correlation: Record<string, Record<string, number | null>>;
  observations: Record<string, number>;
} {
  const assets = Object.keys(returns);
  const len = returns[assets[0]]?.length ?? 0;
  const startIdx = Math.max(0, len - window);

  // Get windowed returns
  const windowed: Record<string, (number | null)[]> = {};
  for (const asset of assets) {
    windowed[asset] = returns[asset].slice(startIdx);
  }

  // Count observations per asset
  const observations: Record<string, number> = {};
  for (const asset of assets) {
    observations[asset] = windowed[asset].filter((v) => v != null).length;
  }

  // Pairwise covariance
  const covariance: Record<string, Record<string, number | null>> = {};
  const correlation: Record<string, Record<string, number | null>> = {};

  for (const a of assets) {
    covariance[a] = {};
    correlation[a] = {};
    for (const b of assets) {
      const pairs: { ra: number; rb: number }[] = [];
      for (let i = 0; i < windowed[a].length; i++) {
        const va = windowed[a][i];
        const vb = windowed[b][i];
        if (va != null && vb != null) {
          pairs.push({ ra: va, rb: vb });
        }
      }

      if (pairs.length < minPeriods) {
        covariance[a][b] = null;
        correlation[a][b] = null;
        continue;
      }

      const n = pairs.length;
      const meanA = pairs.reduce((s, p) => s + p.ra, 0) / n;
      const meanB = pairs.reduce((s, p) => s + p.rb, 0) / n;
      const cov = pairs.reduce((s, p) => s + (p.ra - meanA) * (p.rb - meanB), 0) / (n - 1);
      covariance[a][b] = safeRound(cov, 10);

      // Correlation
      const stdA = Math.sqrt(pairs.reduce((s, p) => s + (p.ra - meanA) ** 2, 0) / (n - 1));
      const stdB = Math.sqrt(pairs.reduce((s, p) => s + (p.rb - meanB) ** 2, 0) / (n - 1));
      if (stdA > 0 && stdB > 0) {
        correlation[a][b] = safeRound(cov / (stdA * stdB), 4);
      } else {
        correlation[a][b] = null;
      }
    }
  }

  return { covariance, correlation, observations };
}

/**
 * Find the last non-null price on or before a target date.
 */
export function findPrice(
  dates: string[],
  prices: (number | null)[],
  targetDate: string,
): { price: number | null; date: string | null } {
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= targetDate && prices[i] != null) {
      return { price: prices[i], date: dates[i] };
    }
  }
  return { price: null, date: null };
}

function safeRound(value: number | null, decimals = 3): number | null {
  if (value == null || isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
