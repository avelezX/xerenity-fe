/* eslint-disable jsx-a11y/control-has-associated-label */
/**
 * Pricer de Opciones USDCOP — prototipo.
 *
 * Opciones vanilla (call/put) europeas sobre USDCOP, valoradas con
 * Black-76 sobre el forward (ver src/lib/pricing/fxOption.ts). Los inputs
 * de mercado (spot, forward NDF, descuento IBR) se anclan a market_marks
 * vía src/models/pricing/fxOptionInputs.ts.
 *
 * Supuesto de vol: curva PLANA bid/offer (default 12%/14%) hasta 3M. El
 * premium se cotiza como banda: bid = vol baja, offer = vol alta.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Button, Form, Alert } from 'react-bootstrap';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, ReferenceLine,
} from 'recharts';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faCalculator, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import { priceFxOption, type FxOptionType } from 'src/lib/pricing/fxOption';
import { buildFxOptionInputs } from 'src/models/pricing/fxOptionInputs';
import type { FxOptionMarketInputs } from 'src/types/pricing';

const PAGE_TITLE = 'Pricer de Opciones USDCOP';

const TENOR_OPTIONS = [
  { label: '1 mes', months: 1 },
  { label: '2 meses', months: 2 },
  { label: '3 meses', months: 3 },
];

const fmtCop = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCop0 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUsd0 = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;
const fmtNum = (n: number, d = 4) => n.toFixed(d);
const fmtCopM = (n: number) => `${(n / 1e6).toFixed(1)}M`;

const moneynessColor = (m: string) => {
  if (m === 'ITM') return '#059669';
  if (m === 'OTM') return '#dc2626';
  return '#2563eb'; // ATMF
};

const forwardSourceLabel = (s: FxOptionMarketInputs['forwardSource']) => {
  if (s === 'ndf') return 'curva NDF';
  if (s === 'cip') return 'paridad CIP (IBR/SOFR)';
  return 'spot';
};

// ── estilos compartidos (calcados de usdcop-calculator) ──
const statCardStyle = { background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 10, padding: '14px 16px' };
const statLabel = { fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 };
const statVal = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.15rem', fontWeight: 600, marginTop: 4 };
const panelStyle = { background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 22, marginBottom: 20 };
const inputLabel = { fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 };

export default function FxOptionPricerPage() {
  const filterDate = useAppStore((s) => s.globalEvaluationDate);

  // ── inputs de usuario ──
  const [optionType, setOptionType] = useState<FxOptionType>('call');
  const [tenorMonths, setTenorMonths] = useState(3);
  const [strike, setStrike] = useState<number | null>(null);
  const [strikeTouched, setStrikeTouched] = useState(false);
  const [notionalUsd, setNotionalUsd] = useState(1_000_000);
  const [volBidPct, setVolBidPct] = useState(12);
  const [volOfferPct, setVolOfferPct] = useState(14);

  // ── inputs de mercado (async) ──
  const [market, setMarket] = useState<FxOptionMarketInputs | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    try {
      const inputs = await buildFxOptionInputs({ evalDate: filterDate, tenorMonths });
      setMarket(inputs);
      // Default strike = ATM forward (redondeado) si el usuario no lo tocó.
      if (!strikeTouched) setStrike(Math.round(inputs.forward));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando inputs de mercado');
      setMarket(null);
    } finally {
      setLoading(false);
    }
  }, [filterDate, tenorMonths, strikeTouched]);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  const setStrikeToAtmf = () => {
    if (market) {
      setStrike(Math.round(market.forward));
      setStrikeTouched(false);
    }
  };

  // ── pricing (síncrono, closed-form) ──
  const quote = useMemo(() => {
    if (!market || strike == null || strike <= 0) return null;
    const common = {
      type: optionType,
      F: market.forward,
      K: strike,
      T: market.T,
      rCop: market.rCopCont,
      spot: market.spot,
    };
    const volMidPct = (volBidPct + volOfferPct) / 2;
    const bid = priceFxOption({ ...common, sigma: volBidPct / 100 });
    const offer = priceFxOption({ ...common, sigma: volOfferPct / 100 });
    const mid = priceFxOption({ ...common, sigma: volMidPct / 100 });

    // Conversión a montos totales (por 1 USD → notional).
    const toAmounts = (premiumCop: number) => ({
      pipsCop: premiumCop, // COP por USD
      totalCop: premiumCop * notionalUsd,
      totalUsd: (premiumCop / market.spot) * notionalUsd,
      pctNotional: premiumCop / market.spot, // = premiumUsd / notionalUsd
    });

    return {
      volMidPct,
      bid: { ...bid, ...toAmounts(bid.premiumCop) },
      offer: { ...offer, ...toAmounts(offer.premiumCop) },
      mid: { ...mid, ...toAmounts(mid.premiumCop) },
    };
  }, [market, strike, optionType, volBidPct, volOfferPct, notionalUsd]);

  const moneyness = useMemo(() => {
    if (!market || strike == null) return null;
    const atmf = market.forward;
    if (Math.abs(strike - atmf) < atmf * 0.001) return 'ATMF';
    const itm =
      optionType === 'call' ? market.spot > strike : market.spot < strike;
    return itm ? 'ITM' : 'OTM';
  }, [market, strike, optionType]);

  // ── Payoff a vencimiento (perspectiva comprador / long) ──
  // P&L neto en COP = payoff intrínseco al vencimiento − prima mid pagada,
  // escalado al nocional. Sin descontar (convención de diagrama de payoff).
  const payoff = useMemo(() => {
    if (!market || !quote || strike == null || strike <= 0) return null;
    const premiumPips = quote.mid.premiumCop; // COP por USD
    const center = market.forward;
    const lo = center * 0.82;
    const hi = center * 1.18;
    const N = 61;
    const data = Array.from({ length: N }, (_, i) => {
      const s = lo + ((hi - lo) * i) / (N - 1);
      const gross =
        optionType === 'call' ? Math.max(s - strike, 0) : Math.max(strike - s, 0);
      const net = gross - premiumPips;
      return { s, grossCop: gross * notionalUsd, netCop: net * notionalUsd };
    });
    const breakeven =
      optionType === 'call' ? strike + premiumPips : strike - premiumPips;
    const maxLossCop = -premiumPips * notionalUsd; // prima pagada
    return { data, breakeven, maxLossCop };
  }, [market, quote, strike, optionType, notionalUsd]);

  return (
    <CoreLayout>
      <RoleGuard requiredRole="lector">
        <Container fluid className="py-3">
          <PageTitle>
            <Icon icon={faCalculator} />
            <h4>{PAGE_TITLE}</h4>
          </PageTitle>

          <Row className="mb-3 align-items-center">
            <Col xs="auto">
              <Button variant="primary" size="sm" onClick={loadMarket} disabled={loading}>
                <Icon icon={faSyncAlt} className={loading ? 'fa-spin me-1' : 'me-1'} />
                Actualizar mercado
              </Button>
            </Col>
            <Col>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                Opciones vanilla europeas USDCOP · Black-76 sobre forward · vol plana bid/offer.
                Fuente: <code>market_marks</code> (spot + NDF + IBR) EOD.
              </span>
            </Col>
          </Row>

          {loading && !market && <p className="text-muted">Cargando inputs de mercado...</p>}

          {market && (
            <>
              {/* ── Inputs de mercado (transparencia) ── */}
              <Row className="g-2 mb-3">
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>Spot USDCOP</div>
                    <div style={statVal}>{fmtCop(market.spot)}</div>
                  </div>
                </Col>
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>Forward {tenorMonths}M</div>
                    <div style={statVal}>{fmtCop(market.forward)}</div>
                  </div>
                </Col>
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>Puntos fwd</div>
                    <div style={statVal}>{fmtCop(market.fwdPointsCop)}</div>
                  </div>
                </Col>
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>IBR {tenorMonths}M (E.A.)</div>
                    <div style={statVal}>{fmtPct(market.rCopEA)}</div>
                  </div>
                </Col>
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>DF COP</div>
                    <div style={statVal}>{fmtNum(market.dfCop, 5)}</div>
                  </div>
                </Col>
                <Col xs={6} md={2}>
                  <div style={statCardStyle}>
                    <div style={statLabel}>Vence</div>
                    <div style={statVal}>{market.maturityDate}</div>
                  </div>
                </Col>
              </Row>

              {market.warnings.length > 0 && (
                <Alert variant="warning" style={{ fontSize: '0.85rem' }}>
                  {market.warnings.map((w) => (
                    <div key={w}>⚠️ {w}</div>
                  ))}
                </Alert>
              )}

              {/* ── Panel de inputs del usuario ── */}
              <div style={panelStyle}>
                <Row className="g-3">
                  <Col xs={6} md={2}>
                    <div style={inputLabel}>Tipo</div>
                    <Form.Select
                      size="sm"
                      value={optionType}
                      onChange={(e) => setOptionType(e.target.value as FxOptionType)}
                    >
                      <option value="call">Call (compra USD)</option>
                      <option value="put">Put (venta USD)</option>
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={2}>
                    <div style={inputLabel}>Tenor</div>
                    <Form.Select
                      size="sm"
                      value={tenorMonths}
                      onChange={(e) => setTenorMonths(Number(e.target.value))}
                    >
                      {TENOR_OPTIONS.map((t) => (
                        <option key={t.months} value={t.months}>
                          {t.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3}>
                    <div style={inputLabel}>
                      Strike (COP/USD){' '}
                      {moneyness && (
                        <span style={{ color: moneynessColor(moneyness) }}>
                          · {moneyness}
                        </span>
                      )}
                    </div>
                    <div className="d-flex gap-1">
                      <Form.Control
                        size="sm"
                        type="number"
                        value={strike ?? ''}
                        onChange={(e) => {
                          setStrike(e.target.value === '' ? null : Number(e.target.value));
                          setStrikeTouched(true);
                        }}
                      />
                      <Button size="sm" variant="outline-secondary" onClick={setStrikeToAtmf} title="Strike = forward ATM">
                        ATMF
                      </Button>
                    </div>
                  </Col>
                  <Col xs={6} md={2}>
                    <div style={inputLabel}>Nocional (USD)</div>
                    <Form.Control
                      size="sm"
                      type="number"
                      step={100000}
                      value={notionalUsd}
                      onChange={(e) => setNotionalUsd(Number(e.target.value))}
                    />
                  </Col>
                  <Col xs={6} md={3}>
                    <div style={inputLabel}>Vol bid / offer (%)</div>
                    <div className="d-flex gap-1 align-items-center">
                      <Form.Control
                        size="sm"
                        type="number"
                        step={0.25}
                        value={volBidPct}
                        onChange={(e) => setVolBidPct(Number(e.target.value))}
                      />
                      <span className="text-muted">/</span>
                      <Form.Control
                        size="sm"
                        type="number"
                        step={0.25}
                        value={volOfferPct}
                        onChange={(e) => setVolOfferPct(Number(e.target.value))}
                      />
                    </div>
                  </Col>
                </Row>
              </div>

              {/* ── Resultados: premium bid/offer ── */}
              {quote && (
                <>
                  <h5 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: 700 }}>
                    Prima {optionType === 'call' ? 'Call' : 'Put'} · banda vol {volBidPct}% / {volOfferPct}%
                  </h5>
                  <div style={{ ...panelStyle, overflowX: 'auto' }}>
                    <table className="table table-sm" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #d9e1ec' }}>
                          <th style={statLabel}>&nbsp;</th>
                          <th style={{ ...statLabel, textAlign: 'right' }}>Bid ({volBidPct}%)</th>
                          <th style={{ ...statLabel, textAlign: 'right' }}>Mid ({quote.volMidPct}%)</th>
                          <th style={{ ...statLabel, textAlign: 'right' }}>Offer ({volOfferPct}%)</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        <tr>
                          <td>Pips COP (por USD)</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop(quote.bid.pipsCop)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCop(quote.mid.pipsCop)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop(quote.offer.pipsCop)}</td>
                        </tr>
                        <tr>
                          <td>% del nocional</td>
                          <td style={{ textAlign: 'right' }}>{fmtPct(quote.bid.pctNotional, 3)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtPct(quote.mid.pctNotional, 3)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtPct(quote.offer.pctNotional, 3)}</td>
                        </tr>
                        <tr>
                          <td>Prima total (COP)</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop0(quote.bid.totalCop)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCop0(quote.mid.totalCop)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop0(quote.offer.totalCop)}</td>
                        </tr>
                        <tr>
                          <td>Prima total (USD)</td>
                          <td style={{ textAlign: 'right' }}>{fmtUsd0(quote.bid.totalUsd)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtUsd0(quote.mid.totalUsd)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtUsd0(quote.offer.totalUsd)}</td>
                        </tr>
                        <tr>
                          <td>Valor temporal (pips)</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop(quote.bid.timeValueCop)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCop(quote.mid.timeValueCop)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtCop(quote.offer.timeValueCop)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ── Griegas (a vol mid, escaladas al nocional) ── */}
                  <h5 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: 700 }}>
                    Griegas · vol mid {quote.volMidPct}% · nocional {fmtUsd0(notionalUsd)} USD
                  </h5>
                  <Row className="g-2 mb-4">
                    <Col xs={6} md>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Delta (Δ)</div>
                        <div style={statVal}>{fmtNum(quote.mid.greeks.delta, 4)}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                          {fmtCop0(quote.mid.greeks.delta * notionalUsd)} COP / +1 spot
                        </div>
                      </div>
                    </Col>
                    <Col xs={6} md>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Gamma (Γ)</div>
                        <div style={statVal}>{fmtNum(quote.mid.greeks.gamma, 6)}</div>
                      </div>
                    </Col>
                    <Col xs={6} md>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Vega (por 1% vol)</div>
                        <div style={statVal}>{fmtCop(quote.mid.greeks.vega)}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                          {fmtCop0(quote.mid.greeks.vega * notionalUsd)} COP
                        </div>
                      </div>
                    </Col>
                    <Col xs={6} md>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Theta (por día)</div>
                        <div style={statVal}>{fmtCop(quote.mid.greeks.theta)}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                          {fmtCop0(quote.mid.greeks.theta * notionalUsd)} COP
                        </div>
                      </div>
                    </Col>
                    <Col xs={6} md>
                      <div style={statCardStyle}>
                        <div style={statLabel}>Rho (por 1% tasa)</div>
                        <div style={statVal}>{fmtCop(quote.mid.greeks.rho)}</div>
                      </div>
                    </Col>
                  </Row>

                  {/* ── Diagrama de payoff a vencimiento ── */}
                  {payoff && (
                    <>
                      <h5 style={{ fontSize: '1.1rem', marginBottom: 4, fontWeight: 700 }}>
                        Payoff a vencimiento · {optionType === 'call' ? 'Call' : 'Put'} comprado
                      </h5>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12 }}>
                        P&amp;L neto (COP) del comprador vs. spot al vencimiento · prima mid{' '}
                        {fmtCop(quote.mid.premiumCop)} pips · break-even{' '}
                        <strong>{fmtCop(payoff.breakeven)}</strong> · pérdida máx.{' '}
                        <strong style={{ color: '#dc2626' }}>{fmtCop0(payoff.maxLossCop)} COP</strong>
                      </div>
                      <div style={{ ...panelStyle, height: 420 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={payoff.data} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,225,236,0.6)" />
                            <XAxis
                              dataKey="s"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              tickFormatter={(v: number) => fmtCop0(v)}
                              tickLine={false}
                              label={{ value: 'Spot USDCOP al vencimiento', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              tickFormatter={(v: number) => fmtCopM(v)}
                              width={70}
                              tickLine={false}
                              label={{ value: 'P&L (COP)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                const labelMap: Record<string, string> = { netCop: 'P&L neto', grossCop: 'Payoff bruto' };
                                return [`${fmtCop0(value)} COP`, labelMap[name] ?? name];
                              }}
                              labelFormatter={(v: number) => `Spot ${fmtCop(v)}`}
                              contentStyle={{ borderRadius: 8, border: '1px solid #d9e1ec' }}
                            />
                            <Legend
                              formatter={(value: string) => {
                                const labelMap: Record<string, string> = { netCop: 'P&L neto', grossCop: 'Payoff bruto' };
                                return labelMap[value] ?? value;
                              }}
                              wrapperStyle={{ fontSize: '0.78rem' }}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                            <ReferenceLine x={strike ?? undefined} stroke="#2563eb" strokeDasharray="6 4" label={{ value: 'K', fill: '#2563eb', fontSize: 11, position: 'top' }} />
                            <ReferenceLine x={payoff.breakeven} stroke="#d97706" strokeDasharray="6 4" label={{ value: 'BE', fill: '#d97706', fontSize: 11, position: 'top' }} />
                            <ReferenceLine x={market.forward} stroke="#059669" strokeDasharray="2 4" label={{ value: 'Fwd', fill: '#059669', fontSize: 11, position: 'top' }} />
                            <Line type="monotone" dataKey="grossCop" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={false} />
                            <Line type="monotone" dataKey="netCop" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Forward: <strong>{forwardSourceLabel(market.forwardSource)}</strong>{' '}
                    · mark {market.markDate} · d1 {fmtNum(quote.mid.d1, 4)} / d2 {fmtNum(quote.mid.d2, 4)}.
                    Prototipo — vol plana sin smile ni term structure.
                  </div>
                </>
              )}
            </>
          )}
        </Container>
      </RoleGuard>
    </CoreLayout>
  );
}
