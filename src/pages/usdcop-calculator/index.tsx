/* eslint-disable jsx-a11y/control-has-associated-label, no-nested-ternary */
/**
 * Calculadora USDCOP.
 *
 * Pagina standalone — antes vivia como tab dentro de /risk-management.
 * Se extrajo en mayo 2026 para mejorar discoverability: la calculadora
 * es una herramienta independiente, no un sub-feature de Exposicion.
 *
 * Lee market_marks.fx_spot del store global (selector de fecha del
 * CoreLayout) y calcula TRM spot + volatilidad rolling 180d + bandas
 * de proyeccion (piso/techo/amplitud/confianza) bajo supuesto de
 * normalidad y raiz del tiempo.
 */
import { useState, useEffect, useCallback } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faCalculator, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Area, Line,
} from 'recharts';
import { fetchUsdCopCalculator } from 'src/models/risk/usdcopCalculator';
import type { UsdCopData } from 'src/models/risk/usdcopCalculator';

const PAGE_TITLE = 'Calculadora USDCOP';

export default function UsdCopCalculatorPage() {
  const filterDate = useAppStore((s) => s.globalEvaluationDate);

  const [usdcopData, setUsdcopData] = useState<UsdCopData | null>(null);
  const [usdcopLoading, setUsdcopLoading] = useState(false);
  const [usdcopDays, setUsdcopDays] = useState(30);
  const [usdcopSigma, setUsdcopSigma] = useState(2.0);

  const handleFetch = useCallback(async () => {
    setUsdcopLoading(true);
    try {
      const data = await fetchUsdCopCalculator(filterDate);
      setUsdcopData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando calculadora USDCOP');
    } finally {
      setUsdcopLoading(false);
    }
  }, [filterDate]);

  // Auto-load al entrar y al cambiar fecha global
  useEffect(() => {
    handleFetch();
  }, [handleFetch]);

  // Styles compartidos
  const statCardStyle = { background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 10, padding: '14px 16px' };
  const statLabel = { fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 };
  const statVal = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.3rem', fontWeight: 600, marginTop: 4 };
  const resultCardStyle = { background: '#eef2f8', border: '1px solid #d9e1ec', borderRadius: 10, padding: '14px', textAlign: 'center' as const };
  const resultLabel = { fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 };
  const resultVal = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '1.45rem', fontWeight: 700, marginTop: 6 };

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
              <Button variant="primary" size="sm" onClick={handleFetch} disabled={usdcopLoading}>
                <Icon icon={faSyncAlt} className={usdcopLoading ? 'fa-spin me-1' : 'me-1'} />
                Actualizar
              </Button>
            </Col>
            <Col>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                Proyección de rango de precio basada en volatilidad histórica rolling 180 días.
                Fuente: <code>market_marks.fx_spot</code> EOD.
              </span>
            </Col>
          </Row>

          {usdcopLoading && !usdcopData && <p className="text-muted">Cargando datos...</p>}

          {usdcopData && (() => {
            const TRM = usdcopData.trm;
            const VOL_D = usdcopData.vol_diaria;
            const CONF: Record<string, number> = {
              '0.5': 38.3, '1': 68.3, '1.5': 86.6, '2': 95.4, '2.5': 98.8, '3': 99.7,
            };
            const bandAt = (t: number, k: number) => {
              const sig = VOL_D * Math.sqrt(t) * k;
              return { floor: TRM * (1 - sig), ceil: TRM * (1 + sig) };
            };
            const { floor, ceil } = bandAt(usdcopDays, usdcopSigma);
            const width = ceil - floor;
            const widthPct = (width / TRM) * 100;
            const confKey = usdcopSigma.toString();
            const conf = CONF[confKey] ?? CONF[usdcopSigma.toFixed(1)] ?? 0;
            const fmtUsdcop = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const chartData = Array.from({ length: usdcopDays + 1 }, (_, t) => {
              if (t === 0) {
                return { t, floor: TRM, ceil: TRM, trm: TRM, spread: 0 };
              }
              const b = bandAt(t, usdcopSigma);
              return { t, floor: b.floor, ceil: b.ceil, trm: TRM, spread: b.ceil - b.floor };
            });

            return (
              <>
                <Row className="g-2 mb-3">
                  <Col xs={6} md={3}>
                    <div style={statCardStyle}>
                      <div style={statLabel}>TRM actual</div>
                      <div style={statVal}>{fmtUsdcop(TRM)}</div>
                    </div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div style={statCardStyle}>
                      <div style={statLabel}>Fecha</div>
                      <div style={statVal}>{usdcopData.fecha.slice(0, 10)}</div>
                    </div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div style={statCardStyle}>
                      <div style={statLabel}>Vol. diaria (180d)</div>
                      <div style={statVal}>{(VOL_D * 100).toFixed(4)}%</div>
                    </div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div style={statCardStyle}>
                      <div style={statLabel}>Vol. anual (180d)</div>
                      <div style={statVal}>{(usdcopData.vol_anual * 100).toFixed(2)}%</div>
                    </div>
                  </Col>
                </Row>

                <h5 style={{ fontSize: '1.1rem', marginTop: 24, marginBottom: 12, fontWeight: 700 }}>1. Calculadora interactiva</h5>

                <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 22, marginBottom: 20 }}>
                  <Row className="g-4">
                    <Col xs={12} md={6}>
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Días a pronosticar</span>
                        <span style={{ color: '#059669', fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>{usdcopDays} día{usdcopDays === 1 ? '' : 's'}</span>
                      </div>
                      <Form.Range min={1} max={180} step={1} value={usdcopDays} onChange={(e) => setUsdcopDays(parseInt(e.target.value, 10))} />
                    </Col>
                    <Col xs={12} md={6}>
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Desviaciones estándar</span>
                        <span style={{ color: '#059669', fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 600 }}>{usdcopSigma.toFixed(1)} σ</span>
                      </div>
                      <Form.Range min={0.5} max={3.0} step={0.5} value={usdcopSigma} onChange={(e) => setUsdcopSigma(parseFloat(e.target.value))} />
                    </Col>
                  </Row>

                  <Row className="g-2 mt-2">
                    <Col xs={6} md={3}>
                      <div style={resultCardStyle}>
                        <div style={resultLabel}>Piso</div>
                        <div style={{ ...resultVal, color: '#dc2626' }}>{fmtUsdcop(floor)}</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={resultCardStyle}>
                        <div style={resultLabel}>Techo</div>
                        <div style={{ ...resultVal, color: '#059669' }}>{fmtUsdcop(ceil)}</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={resultCardStyle}>
                        <div style={resultLabel}>Amplitud</div>
                        <div style={{ ...resultVal, color: '#d97706' }}>{fmtUsdcop(width)} ({widthPct.toFixed(1)}%)</div>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div style={resultCardStyle}>
                        <div style={resultLabel}>Confianza</div>
                        <div style={{ ...resultVal, color: '#2563eb' }}>{conf.toFixed(1)}%</div>
                      </div>
                    </Col>
                  </Row>
                </div>

                <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 20, marginBottom: 28, height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(217,225,236,0.6)" />
                      <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} label={{ value: 'Días hacia adelante', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => fmtUsdcop(v)} width={75} domain={['auto', 'auto']} tickLine={false} label={{ value: 'COP por USD', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          const labelMap: Record<string, string> = { floor: 'Piso', ceil: 'Techo', trm: 'TRM actual' };
                          return [fmtUsdcop(value), labelMap[name] ?? name];
                        }}
                        labelFormatter={(v: number) => `Día ${v}`}
                        contentStyle={{ borderRadius: 8, border: '1px solid #d9e1ec' }}
                      />
                      <Legend
                        formatter={(value: string) => {
                          const labelMap: Record<string, string> = { floor: 'Piso', ceil: 'Techo', trm: 'TRM actual' };
                          return labelMap[value] ?? value;
                        }}
                        wrapperStyle={{ fontSize: '0.78rem' }}
                      />
                      <Area type="monotone" dataKey="ceil" stroke="#059669" fill="rgba(5,150,105,0.12)" strokeWidth={2} dot={false} activeDot={false} />
                      <Area type="monotone" dataKey="floor" stroke="#dc2626" fill="#ffffff" strokeWidth={2} dot={false} activeDot={false} />
                      <Line type="monotone" dataKey="trm" stroke="#2563eb" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <h5 style={{ fontSize: '1.1rem', marginTop: 24, marginBottom: 12, fontWeight: 700 }}>2. Justificación estadística</h5>

                <div style={{ background: '#f7f9fc', border: '1px solid #d9e1ec', borderRadius: 12, padding: 22, marginBottom: 20 }}>
                  <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 0, marginBottom: 8 }}>¿Qué es la volatilidad rolling 180 días y por qué 180?</h6>
                  <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                    La <strong>volatilidad rolling</strong> es la desviación estándar de los retornos logarítmicos diarios
                    calculada sobre una ventana móvil. Con 180 días hábiles (~9 meses calendario) logramos un balance entre:
                  </p>
                  <ul style={{ color: '#334155', fontSize: '0.92rem' }}>
                    <li><strong>Estabilidad estadística:</strong> suficientes observaciones (~180) para un estimador robusto.</li>
                    <li><strong>Relevancia temporal:</strong> captura el régimen reciente sin arrastrar shocks antiguos.</li>
                    <li><strong>Ciclos macro:</strong> abarca al menos dos reuniones del Banco de la República y un ciclo fiscal parcial.</li>
                  </ul>
                  <p style={{ color: '#334155', fontSize: '0.92rem' }}>
                    Ventanas más cortas (30–60d) son reactivas pero ruidosas; más largas (365d+) suavizan demasiado y ocultan
                    cambios de régimen. 180d es el estándar de la industria para pares FX de mercados emergentes.
                  </p>

                  <h6 style={{ color: '#2563eb', fontSize: '1rem', marginTop: 20, marginBottom: 8 }}>¿Qué significa cada nivel de desviación estándar?</h6>
                  <p style={{ color: '#334155', fontSize: '0.92rem' }}>Bajo el supuesto de normalidad, el siguiente porcentaje de observaciones cae dentro de ±Nσ respecto a la media:</p>
                  <table className="table table-sm" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #d9e1ec' }}>
                        <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Nivel</th>
                        <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Confianza</th>
                        <th style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>Interpretación</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ fontFamily: 'monospace' }}>1.0 σ</td><td style={{ fontFamily: 'monospace' }}>68.3%</td><td>Rango típico, ~2 de 3 días</td></tr>
                      <tr><td style={{ fontFamily: 'monospace' }}>1.5 σ</td><td style={{ fontFamily: 'monospace' }}>86.6%</td><td>Rango amplio, ~6 de 7 días</td></tr>
                      <tr><td style={{ fontFamily: 'monospace' }}>2.0 σ</td><td style={{ fontFamily: 'monospace' }}>95.4%</td><td>Rango conservador, ~19 de 20 días</td></tr>
                      <tr><td style={{ fontFamily: 'monospace' }}>2.5 σ</td><td style={{ fontFamily: 'monospace' }}>98.8%</td><td>Rango extremo, ~1 excepción en 83 días</td></tr>
                      <tr><td style={{ fontFamily: 'monospace' }}>3.0 σ</td><td style={{ fontFamily: 'monospace' }}>99.7%</td><td>Rango máximo, ~1 excepción en 370 días</td></tr>
                    </tbody>
                  </table>

                  <div style={{ background: 'rgba(217,119,6,0.08)', borderLeft: '3px solid #d97706', padding: '12px 14px', borderRadius: 6, marginTop: 12, color: '#78350f', fontSize: '0.9rem' }}>
                    <strong>Regla práctica:</strong> a mayor horizonte y mayor sensibilidad a pérdidas, mayor σ. Pero recuerda
                    que ampliar el rango tiene un costo: decisiones más conservadoras y menos accionables.
                  </div>
                </div>
              </>
            );
          })()}
        </Container>
      </RoleGuard>
    </CoreLayout>
  );
}
