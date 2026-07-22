import { describe, it, expect } from 'vitest';
import {
  priceFxOption,
  normCdf,
  normPdf,
  type FxOptionInput,
} from '../lib/pricing/fxOption';

// Escenario base USDCOP realista: spot ~4000, forward 3M con puntos,
// vol 13% (medio de la banda 12/14), tasa COP ~9.5% continua.
const BASE: Omit<FxOptionInput, 'type' | 'K'> = {
  F: 4050,
  T: 0.25, // 3 meses
  sigma: 0.13,
  rCop: 0.095,
  spot: 4000,
};

const ATM: FxOptionInput = { ...BASE, type: 'call', K: 4050 };

describe('normCdf / normPdf', () => {
  it('Φ(0) = 0.5, Φ es simétrica', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 4);
    expect(normCdf(2.5) + normCdf(-2.5)).toBeCloseTo(1, 6);
  });

  it('φ(0) = 1/√(2π)', () => {
    expect(normPdf(0)).toBeCloseTo(0.3989422804, 8);
    expect(normPdf(1)).toBeCloseTo(0.2419707245, 8);
  });
});

describe('priceFxOption — Black-76', () => {
  it('cumple put-call parity: c − p = DF·(F − K)', () => {
    const K = 4100;
    const c = priceFxOption({ ...BASE, type: 'call', K });
    const p = priceFxOption({ ...BASE, type: 'put', K });
    const dfCop = Math.exp(-BASE.rCop * BASE.T);
    expect(c.premiumCop - p.premiumCop).toBeCloseTo(dfCop * (BASE.F - K), 6);
  });

  it('ATM: call y put valen casi lo mismo (F=K)', () => {
    const c = priceFxOption({ ...ATM, type: 'call' });
    const p = priceFxOption({ ...ATM, type: 'put' });
    // A F=K la parity da c−p = 0 exacto.
    expect(c.premiumCop).toBeCloseTo(p.premiumCop, 6);
    expect(c.premiumCop).toBeGreaterThan(0);
  });

  it('call deep ITM ≈ intrínseco descontado; deep OTM ≈ 0', () => {
    const itm = priceFxOption({ ...BASE, type: 'call', K: 1000 });
    const dfCop = Math.exp(-BASE.rCop * BASE.T);
    expect(itm.premiumCop).toBeCloseTo(dfCop * (BASE.F - 1000), 0);
    expect(itm.timeValueCop).toBeLessThan(1); // sin valor temporal apreciable

    const otm = priceFxOption({ ...BASE, type: 'call', K: 9000 });
    expect(otm.premiumCop).toBeGreaterThanOrEqual(0);
    expect(otm.premiumCop).toBeLessThan(1);
  });

  it('la prima es monótona creciente en la vol', () => {
    const lo = priceFxOption({ ...ATM, sigma: 0.12 });
    const mid = priceFxOption({ ...ATM, sigma: 0.13 });
    const hi = priceFxOption({ ...ATM, sigma: 0.14 });
    expect(lo.premiumCop).toBeLessThan(mid.premiumCop);
    expect(mid.premiumCop).toBeLessThan(hi.premiumCop);
  });

  it('banda bid/offer: offer (14%) > bid (12%)', () => {
    const bid = priceFxOption({ ...ATM, sigma: 0.12 });
    const offer = priceFxOption({ ...ATM, sigma: 0.14 });
    expect(offer.premiumCop).toBeGreaterThan(bid.premiumCop);
  });

  it('griegas ATM tienen signo/rango esperado', () => {
    const c = priceFxOption({ ...ATM, type: 'call' });
    const p = priceFxOption({ ...ATM, type: 'put' });
    // Call delta ATM ~ +0.5·q; put delta ATM ~ −0.5·q (q = F/S ≈ 1.0125).
    expect(c.greeks.delta).toBeGreaterThan(0);
    expect(c.greeks.delta).toBeLessThan(1);
    expect(p.greeks.delta).toBeLessThan(0);
    // Vega y gamma > 0 e iguales entre call/put ATM.
    expect(c.greeks.vega).toBeGreaterThan(0);
    expect(c.greeks.vega).toBeCloseTo(p.greeks.vega, 6);
    expect(c.greeks.gamma).toBeCloseTo(p.greeks.gamma, 6);
    // Theta de una long ATM es negativa (decae).
    expect(c.greeks.theta).toBeLessThan(0);
  });

  it('put-call parity también en las deltas: Δc − Δp = DF·q', () => {
    const K = 4100;
    const c = priceFxOption({ ...BASE, type: 'call', K });
    const p = priceFxOption({ ...BASE, type: 'put', K });
    const dfCop = Math.exp(-BASE.rCop * BASE.T);
    const q = BASE.F / BASE.spot;
    expect(c.greeks.delta - p.greeks.delta).toBeCloseTo(dfCop * q, 6);
  });

  it('vega numérica ≈ vega analítica (finite difference)', () => {
    const h = 1e-4;
    const up = priceFxOption({ ...ATM, sigma: 0.13 + h });
    const dn = priceFxOption({ ...ATM, sigma: 0.13 - h });
    const numericPer1pct = ((up.premiumCop - dn.premiumCop) / (2 * h)) * 0.01;
    const analytic = priceFxOption({ ...ATM, sigma: 0.13 }).greeks.vega;
    expect(analytic).toBeCloseTo(numericPer1pct, 4);
  });

  it('delta numérica ≈ delta analítica (bump spot → forward)', () => {
    // Bump spot manteniendo puntos forward fijos: F escala con spot (q constante).
    const q = BASE.F / BASE.spot;
    const h = 0.5;
    const up = priceFxOption({ ...ATM, spot: BASE.spot + h, F: (BASE.spot + h) * q });
    const dn = priceFxOption({ ...ATM, spot: BASE.spot - h, F: (BASE.spot - h) * q });
    const numeric = (up.premiumCop - dn.premiumCop) / (2 * h);
    const analytic = priceFxOption({ ...ATM }).greeks.delta;
    expect(analytic).toBeCloseTo(numeric, 4);
  });

  it('T=0 devuelve intrínseco puro sin valor temporal', () => {
    const c = priceFxOption({ ...BASE, type: 'call', K: 4000, T: 0 });
    expect(c.premiumCop).toBeCloseTo(BASE.F - 4000, 6);
    expect(c.timeValueCop).toBe(0);
  });

  // Snapshot de mercado real (market_marks 2026-07-22): valida la cadena
  // completa con los mismos números que produciría la página.
  it('snapshot real: ATMF 3M call ~83 pips (≈ regla 0.4·σ·√T·F)', () => {
    const spot = 3204.44;
    const F = 3269.9596; // ndf["3"].F_market
    const rCopEA = 0.1181; // ibr_3m
    const rCopCont = Math.log(1 + rCopEA);
    const T = 0.25;
    const K = Math.round(F); // ATMF
    const call = priceFxOption({ type: 'call', F, K, T, sigma: 0.13, rCop: rCopCont, spot });
    // Aproximación de mesa para ATM: 0.4·σ·√T·F ≈ 85 pips.
    const ruleOfThumb = 0.4 * 0.13 * Math.sqrt(T) * F;
    expect(call.premiumCop).toBeGreaterThan(75);
    expect(call.premiumCop).toBeLessThan(90);
    expect(call.premiumCop).toBeCloseTo(ruleOfThumb, -1); // mismo orden de magnitud
    // % del nocional razonable para 13% vol 3M.
    expect(call.premiumCop / spot).toBeGreaterThan(0.02);
    expect(call.premiumCop / spot).toBeLessThan(0.03);
  });
});
