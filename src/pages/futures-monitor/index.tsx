'use client';

/* eslint-disable jsx-a11y/control-has-associated-label, @typescript-eslint/no-use-before-define */
/**
 * Monitor de Futuros — pagina principal.
 *
 * PR 2 (shell): cabecera + KPI strip + tab bar con placeholders para los
 * 6 tabs (Curva, Calendars, Butterflies, Slopes, Front, Scanner).
 *
 * Estetica: trading desk precision — IBM Plex Mono, tabular-nums, amber
 * instrumental #9a3412, hairlines 1px, sin shadows ni gradientes. Match
 * exacto con GlobalDateSelector y la tabla del Benchmark.
 *
 * Acceso: corp_admin / super_admin. Visible cuando la empresa tiene
 * AZUCAR en su risk_company_config.commodities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CoreLayout } from '@layout';
import { Container } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faChartArea,
  faSyncAlt,
  faCircleNotch,
  faStar,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import { fetchCompanyRiskConfig } from 'src/lib/risk/companyConfig';
import type { RiskCompanyConfig } from 'src/lib/risk/companyConfig';
import { fetchSugarSnapshot } from 'src/lib/futures-monitor/api';
import type { SugarSnapshot } from 'src/lib/futures-monitor/types';

// ─────────────────────────────────────────────────────────────────
// Design tokens (scoped a esta pagina)
// ─────────────────────────────────────────────────────────────────
const T = {
  ink: '#0f172a',
  inkSoft: '#1e293b',
  muted: '#64748b',
  mutedDim: '#94a3b8',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  hairline: '#cbd5e1',
  hairlineSoft: '#e2e8f0',
  accent: '#9a3412',
  accentSoft: '#fed7aa',
  green: '#15803d',
  red: '#b91c1c',
};

const MONO = "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

// Tabs disponibles. Los marcados como `comingSoon` se renderizan disabled.
const TABS = [
  { key: 'curva',        label: 'Curva',        icon: faChartArea, comingSoon: true },
  { key: 'calendars',    label: 'Calendars',    icon: faChartLine, comingSoon: true },
  { key: 'butterflies',  label: 'Butterflies',  icon: faChartLine, comingSoon: true },
  { key: 'slopes',       label: 'Slopes',       icon: faChartLine, comingSoon: true },
  { key: 'front',        label: 'Front Month',  icon: faChartLine, comingSoon: true },
  { key: 'scanner',      label: 'Scanner',      icon: faStar,      comingSoon: true },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ─────────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────────
function fmtPrice(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}%`;
}

function pctColor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return T.muted;
  if (v > 0) return T.green;
  if (v < 0) return T.red;
  return T.muted;
}

function estructuraColor(estructura: string): string {
  if (estructura === 'Contango') return T.accent;
  if (estructura === 'Backwardation') return T.green;
  return T.muted;
}

// ─────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────
function FuturesMonitorPage() {
  const { userProfile, selectedCompanyId } = useAppStore();

  const [companyConfig, setCompanyConfig] = useState<RiskCompanyConfig | null>(null);
  const [snapshot, setSnapshot] = useState<SugarSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('curva');

  // Cargar company config para gate por AZUCAR
  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchCompanyRiskConfig(selectedCompanyId)
      .then(setCompanyConfig)
      .catch(() => setCompanyConfig(null));
  }, [selectedCompanyId]);

  const hasAzucar = companyConfig?.commodities?.some((c) => c.asset === 'AZUCAR') ?? false;

  const loadSnapshot = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const data = await fetchSugarSnapshot({ refresh });
      setSnapshot(data);
      if (refresh) toast.success('Snapshot actualizado');
    } catch (e: unknown) {
      toast.error(`Error: ${(e as Error)?.message ?? 'desconocido'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount (solo si el gate de AZUCAR pasa)
  useEffect(() => {
    if (!hasAzucar) return;
    loadSnapshot(false);
  }, [hasAzucar, loadSnapshot]);

  const kpis = snapshot?.kpis;
  const ranges52w =
    kpis?.range_52w_min != null && kpis?.range_52w_max != null
      ? `${fmtPrice(kpis.range_52w_min)} − ${fmtPrice(kpis.range_52w_max)}`
      : '—';

  return (
    <CoreLayout>
      <RoleGuard
        requiredRole="corp_admin"
        fallback={
          <Container fluid className="p-4">
            <p className="text-muted">No tienes acceso a esta sección.</p>
          </Container>
        }
      >
        <Container fluid className="px-4 py-3">
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <PageTitle>
              <Icon icon={faChartLine} size="1x" />
              <h4 style={{ margin: 0 }}>Monitor de Futuros</h4>
              {userProfile?.role && (
                <span style={{
                  fontSize: 11, color: T.muted, marginLeft: 8,
                  fontFamily: MONO, letterSpacing: '0.06em',
                }}>
                  {companyConfig?.commodities?.length ?? 0} commodities · {snapshot?.asset ?? 'SUGAR'}
                </span>
              )}
            </PageTitle>
            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              {/* Selector de commodity — solo Sugar habilitado por ahora */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', border: `1px solid ${T.hairline}`,
                background: T.surface, fontFamily: MONO, fontSize: 11,
                letterSpacing: '0.08em',
              }}>
                <span style={{ color: T.muted, fontSize: 10 }}>COMMODITY</span>
                <span style={{ color: T.ink, fontWeight: 700 }}>SUGAR (SB)</span>
                <span style={{ color: T.mutedDim, fontSize: 10, marginLeft: 4 }}>· otros próximamente</span>
              </div>
              <Button
                variant="outline-primary"
                onClick={() => loadSnapshot(true)}
                disabled={loading || !hasAzucar}
              >
                <Icon icon={loading ? faCircleNotch : faSyncAlt} className="me-1" spin={loading} />
                Actualizar
              </Button>
            </div>
          </div>

          {/* Gate: empresa sin AZUCAR */}
          {!hasAzucar && companyConfig != null && (
            <div style={{
              padding: '24px',
              border: `1px solid ${T.hairlineSoft}`,
              background: T.surfaceAlt,
              textAlign: 'center',
              color: T.muted,
              fontSize: 13,
            }}>
              <Icon icon={faExclamationTriangle} className="me-2" style={{ color: T.accent }} />
              Tu empresa no tiene <strong style={{ color: T.ink }}>AZÚCAR</strong> configurado en commodities.
              <br />
              El Monitor de Futuros para Sugar (SB) se activa cuando agregas el commodity en
              {' '}<Link href="/risk-management" style={{ color: T.accent }}>Riesgos → Exposición</Link>.
            </div>
          )}

          {/* Loading state inicial — sin snapshot todavia */}
          {hasAzucar && loading && !snapshot && (
            <div style={{
              padding: '40px 24px',
              border: `1px solid ${T.hairlineSoft}`,
              background: T.surfaceAlt,
              textAlign: 'center',
              color: T.muted,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: '0.06em',
            }}>
              <Icon icon={faCircleNotch} spin className="me-2" />
              Descargando datos desde Yahoo Finance...
              <div style={{ fontSize: 10, marginTop: 6 }}>
                El primer hit puede tardar 5–15s
              </div>
            </div>
          )}

          {/* KPI strip — solo cuando hay datos */}
          {hasAzucar && snapshot && (
            <>
              <KPIStrip
                kpis={kpis!}
                ticker={snapshot.ticker}
                asOf={snapshot.as_of}
                range52w={ranges52w}
              />

              <TabBar activeTab={activeTab} onChange={setActiveTab} />

              <ComingSoonPanel activeTab={activeTab} snapshot={snapshot} />
            </>
          )}
        </Container>
      </RoleGuard>
    </CoreLayout>
  );
}

// ─────────────────────────────────────────────────────────────────
// KPI Strip — 6 cards mono, hairline 1px, no shadows
// ─────────────────────────────────────────────────────────────────
function KPIStrip({
  kpis,
  ticker,
  asOf,
  range52w,
}: {
  kpis: NonNullable<SugarSnapshot['kpis']>;
  ticker: string;
  asOf: string;
  range52w: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 0,
      border: `1px solid ${T.hairline}`,
      background: T.surface,
      marginBottom: 16,
    }}>
      <KPICard label="Front Month" sub={`${ticker} · ${kpis.front_month_age_str}`}>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
          {fmtPrice(kpis.front_month_price)}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, marginLeft: 6,
          color: pctColor(kpis.front_month_change_1d_pct),
        }}>
          {fmtPct(kpis.front_month_change_1d_pct)} 1D
        </span>
      </KPICard>

      <KPICard label="Contratos" sub="activos">
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
          {kpis.n_contratos}
        </span>
      </KPICard>

      <KPICard label="Estructura" sub="curva">
        <span style={{
          fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
          color: estructuraColor(kpis.estructura),
          textTransform: 'uppercase',
        }}>
          {kpis.estructura}
        </span>
      </KPICard>

      <KPICard label="Vol 20D" sub="anualizada">
        <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
          {fmtPct(kpis.vol_20d_pct, 1)}
        </span>
      </KPICard>

      <KPICard label="Rango 52W" sub={`as of ${asOf}`}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>
          {range52w}
        </span>
      </KPICard>

      <KPICard label="Señales" sub="operables · ilíquidas">
        <span style={{ fontSize: 16, fontWeight: 700, color: T.green }}>
          {kpis.n_signals_operable}
        </span>
        <span style={{ color: T.mutedDim, margin: '0 4px' }}>·</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.muted }}>
          {kpis.n_signals_iliquid}
        </span>
      </KPICard>
    </div>
  );
}

function KPICard({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRight: `1px solid ${T.hairlineSoft}`,
      fontFamily: MONO,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        color: T.muted, textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: MONO,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {children}
      </div>
      {sub && (
        <div style={{
          fontSize: 9, color: T.mutedDim,
          marginTop: 3, letterSpacing: '0.06em',
          textTransform: 'lowercase',
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tab Bar — match con el resto del modulo de Riesgos
// ─────────────────────────────────────────────────────────────────
function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: `1px solid ${T.hairline}`,
      marginBottom: 16,
      fontFamily: MONO,
    }}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const isScanner = tab.key === 'scanner';
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: isActive ? T.surface : 'transparent',
              borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
              marginBottom: -1,
              color: isActive ? T.ink : T.muted,
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 80ms ease, border-color 80ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget.style.color = T.ink);
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget.style.color = T.muted);
            }}
          >
            {isScanner && <Icon icon={faStar} style={{ fontSize: 10, color: T.accent }} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Coming Soon Panel — placeholder hasta PR 3-5
// ─────────────────────────────────────────────────────────────────
function ComingSoonPanel({
  activeTab,
  snapshot,
}: {
  activeTab: TabKey;
  snapshot: SugarSnapshot;
}) {
  const counts: Record<TabKey, { count: number; label: string }> = {
    curva: { count: snapshot.curve.length, label: 'contratos' },
    calendars: { count: snapshot.calendar_spreads.length, label: 'calendar spreads' },
    butterflies: { count: snapshot.butterflies.length, label: 'butterflies' },
    slopes: { count: snapshot.slopes.length, label: 'slopes' },
    front: { count: snapshot.front_history.length, label: 'puntos de historia 5Y' },
    scanner: {
      count: snapshot.signals_operable.length + snapshot.signals_iliquid.length,
      label: `señales (${snapshot.signals_operable.length} op · ${snapshot.signals_iliquid.length} il)`,
    },
  };
  const c = counts[activeTab];

  return (
    <div style={{
      padding: '32px 24px',
      border: `1px solid ${T.hairlineSoft}`,
      background: T.surfaceAlt,
      textAlign: 'center',
      fontFamily: MONO,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
        color: T.accent, textTransform: 'uppercase', marginBottom: 8,
      }}>
        próximamente
      </div>
      <div style={{
        fontSize: 13, color: T.ink, marginBottom: 6,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}>
        Tab <strong>{TABS.find((t) => t.key === activeTab)?.label}</strong> — UI en construcción.
      </div>
      <div style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
        Backend listo: <strong style={{ color: T.ink }}>{c.count}</strong> {c.label} disponibles
      </div>
      <div style={{
        marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.hairlineSoft}`,
        fontSize: 10, color: T.mutedDim, letterSpacing: '0.06em',
      }}>
        PRs 3–5 conectarán cada tab con tablas, charts (Recharts) y el drawer de playbooks.
      </div>
    </div>
  );
}

export default FuturesMonitorPage;
