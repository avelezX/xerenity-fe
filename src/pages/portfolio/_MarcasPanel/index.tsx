'use client';

/* eslint-disable no-nested-ternary */
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchHistoricalMark } from 'src/models/trading/fetchHistoricalMark';
import useAppStore from 'src/store';
import type {
  HistoricalMark,
  HistoricalTesPoint,
  IbrQuotesCurveRow,
  HistoricalSofrPoint,
  HistoricalNdfPoint,
} from 'src/types/trading';

// ── Helpers ──────────────────────────────────────────────────────────────────

const IBR_TENORS: { key: keyof IbrQuotesCurveRow; label: string }[] = [
  { key: 'ibr_1d', label: '1d' },
  { key: 'ibr_1m', label: '1m' },
  { key: 'ibr_3m', label: '3m' },
  { key: 'ibr_6m', label: '6m' },
  { key: 'ibr_12m', label: '12m' },
  { key: 'ibr_2y', label: '2y' },
  { key: 'ibr_5y', label: '5y' },
  { key: 'ibr_10y', label: '10y' },
  { key: 'ibr_15y', label: '15y' },
  { key: 'ibr_20y', label: '20y' },
];

const SOFR_TENOR_LABEL: Record<number, string> = {
  1: '1M', 3: '3M', 6: '6M', 9: '9M',
  12: '1Y', 24: '2Y', 36: '3Y', 60: '5Y',
  84: '7Y', 120: '10Y', 180: '15Y', 240: '20Y',
};

const fmt2 = (v: number | null | undefined) =>
  v != null ? v.toFixed(2) : '—';

const fmtPct = (v: number | null | undefined) =>
  v != null ? `${v.toFixed(2)}%` : '—';

const fmtPct3 = (v: number | null | undefined) =>
  v != null ? `${(v * 100).toFixed(3)}%` : '—';

/** Format date as YYYY-MM-DD using LOCAL timezone (avoids UTC midnight cutoff issues) */
function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Skip weekends: returns the nearest business day on or before the given date */
function lastBusinessDay(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0) d.setDate(d.getDate() - 2); // Sun → Fri
  else if (day === 6) d.setDate(d.getDate() - 1); // Sat → Fri
  return d;
}

/** Returns last business day in YYYY-MM-DD (local timezone, safe default) */
function defaultFecha(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1); // start from yesterday (local)
  return toLocalYMD(lastBusinessDay(d));
}

/** Step one business day forward/backward (skips weekends) */
function stepDate(fecha: string, delta: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  const step = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= 1; // count only business days
  }
  return toLocalYMD(d);
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Defined before components to avoid no-use-before-define

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 40,
  color: '#adb5bd',
  fontSize: 13,
  border: '1px dashed #dee2e6',
  borderRadius: 6,
};

const thStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: '#f8f9fa',
  border: '1px solid #dee2e6',
  fontWeight: 600,
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: '1px solid #dee2e6',
  textAlign: 'right',
};

const navBtnStyle: React.CSSProperties = {
  border: '1px solid #ced4da',
  borderRadius: 4,
  background: '#fff',
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 13,
  color: '#495057',
};

// ── Sub-tab ───────────────────────────────────────────────────────────────────

type SubTab = 'ibr' | 'sofr' | 'ndf' | 'tes';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'ibr', label: 'IBR' },
  { key: 'sofr', label: 'SOFR' },
  { key: 'ndf', label: 'NDF Fwd Pts' },
  { key: 'tes', label: 'TES' },
];

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({
  label,
  ok,
  loading,
}: {
  label: string;
  ok: boolean;
  loading: boolean;
}) {
  const bg = loading ? '#e9ecef' : ok ? '#d4edda' : '#f8d7da';
  const color = loading ? '#6c757d' : ok ? '#155724' : '#721c24';
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        background: bg,
        color,
        fontWeight: 600,
        fontSize: 12,
        fontFamily: 'monospace',
      }}
    >
      {loading ? `${label} …` : `${label} ${ok ? '✓' : '✗'}`}
    </span>
  );
}

// ── IBR chart ─────────────────────────────────────────────────────────────────

function IbrCurveChart({ ibr }: { ibr: IbrQuotesCurveRow }) {
  const data = IBR_TENORS.map(({ key, label }) => ({
    tenor: label,
    rate: ibr[key] as number | null,
  })).filter((p) => p.rate != null);

  if (data.length === 0) {
    return (
      <div style={emptyStyle}>Sin nodos IBR para esta fecha</div>
    );
  }

  const min = Math.min(...data.map((d) => d.rate!)) - 0.2;
  const max = Math.max(...data.map((d) => d.rate!)) + 0.2;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
        <YAxis
          domain={[min, max]}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          tick={{ fontSize: 11 }}
          width={48}
        />
        <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'IBR']} />
        <ReferenceLine y={data[0]?.rate ?? 0} stroke="#e0e0e0" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#0d6efd"
          strokeWidth={2}
          dot={{ r: 4, fill: '#0d6efd' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── SOFR chart ────────────────────────────────────────────────────────────────

function SofrCurveChart({ sofr }: { sofr: HistoricalSofrPoint[] }) {
  if (sofr.length === 0) {
    return <div style={emptyStyle}>Sin datos SOFR para esta fecha</div>;
  }

  const data = sofr.map((p) => ({
    tenor: SOFR_TENOR_LABEL[p.tenor_months] ?? `${p.tenor_months}M`,
    rate: p.swap_rate,
  }));

  const min = Math.min(...data.map((d) => d.rate)) - 0.1;
  const max = Math.max(...data.map((d) => d.rate)) + 0.1;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
        <YAxis
          domain={[min, max]}
          tickFormatter={(v) => `${v.toFixed(2)}%`}
          tick={{ fontSize: 11 }}
          width={52}
        />
        <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'SOFR Swap']} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#ff7f0e"
          strokeWidth={2}
          dot={{ r: 4, fill: '#ff7f0e' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── NDF fwd pts chart ─────────────────────────────────────────────────────────

function NdfFwdPtsChart({ ndf }: { ndf: HistoricalNdfPoint[] }) {
  const data = ndf
    .filter((p) => p.fwd_points != null || p.mid != null)
    .map((p) => ({
      tenor: p.tenor,
      fwd_pts: p.fwd_points,
      mid: p.mid,
    }));

  if (data.length === 0) {
    return <div style={emptyStyle}>Sin datos NDF fwd pts para esta fecha</div>;
  }

  const vals = data.flatMap((d) =>
    [d.fwd_pts, d.mid].filter((v): v is number => v != null)
  );
  const min = Math.min(...vals) - 5;
  const max = Math.max(...vals) + 5;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
        <YAxis
          domain={[min, max]}
          tickFormatter={(v) => v.toFixed(0)}
          tick={{ fontSize: 11 }}
          width={52}
        />
        <Tooltip
          formatter={(v: number, name: string) => [
            v.toFixed(1),
            name === 'fwd_pts' ? 'Fwd Pts' : 'Mid',
          ]}
        />
        <Line
          type="monotone"
          dataKey="fwd_pts"
          stroke="#1f77b4"
          strokeWidth={2}
          dot={{ r: 4, fill: '#1f77b4' }}
          activeDot={{ r: 6 }}
          name="fwd_pts"
        />
        {data.some((d) => d.mid != null) && (
          <Line
            type="monotone"
            dataKey="mid"
            stroke="#9467bd"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            name="mid"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── TES yield curve chart ─────────────────────────────────────────────────────

function TesCurveChart({ tes }: { tes: HistoricalTesPoint[] }) {
  if (tes.length === 0) {
    return <div style={emptyStyle}>Sin datos TES para esta fecha</div>;
  }

  const sorted = [...tes].sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));
  const data = sorted.map((p) => ({
    name: p.name,
    ytm_pct: p.ytm * 100,
  }));

  const rates = data.map((d) => d.ytm_pct);
  const min = Math.min(...rates) - 0.2;
  const max = Math.max(...rates) + 0.2;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
        <YAxis
          domain={[min, max]}
          tickFormatter={(v) => `${v.toFixed(2)}%`}
          tick={{ fontSize: 11 }}
          width={56}
        />
        <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'YTM']} />
        <Line
          type="monotone"
          dataKey="ytm_pct"
          stroke="#2ca02c"
          strokeWidth={2}
          dot={{ r: 5, fill: '#2ca02c' }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── IBR node table ────────────────────────────────────────────────────────────

function IbrNodeTable({ ibr }: { ibr: IbrQuotesCurveRow }) {
  return (
    <table style={{ fontSize: 11, fontFamily: 'monospace', borderCollapse: 'collapse', marginTop: 8 }}>
      <tbody>
        <tr>
          {IBR_TENORS.map(({ label }) => (
            <th key={label} style={thStyle}>{label}</th>
          ))}
        </tr>
        <tr>
          {IBR_TENORS.map(({ key, label }) => (
            <td key={label} style={tdStyle}>{fmt2(ibr[key] as number | null)}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function MarcasPanel() {
  const [fecha, setFecha] = useState<string>(defaultFecha);
  const [mark, setMark] = useState<HistoricalMark | null>(null);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('ibr');
  const [repriceStatus, setRepriceStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [repriceError, setRepriceError] = useState<string | null>(null);

  const repriceAllWithMark = useAppStore((s) => s.repriceAllWithMark);

  const load = useCallback(async (f: string) => {
    setLoading(true);
    setMark(null);
    setRepriceStatus('idle');
    try {
      const result = await fetchHistoricalMark(f);
      setMark(result);
      // Auto-switch to first sub-tab that has data
      if (!result.hasIbr && result.hasSofr) setSubTab('sofr');
      else if (!result.hasIbr && !result.hasSofr && result.hasNdf) setSubTab('ndf');
      else setSubTab('ibr');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(fecha);
  }, [fecha, load]);

  const handlePrev = () => setFecha((f) => stepDate(f, -1));
  const handleNext = () => {
    const tomorrow = stepDate(toLocalYMD(new Date()), 1);
    setFecha((f) => {
      const next = stepDate(f, 1);
      return next <= tomorrow ? next : f;
    });
  };

  const handleReprice = async () => {
    setRepriceStatus('loading');
    setRepriceError(null);
    try {
      await repriceAllWithMark(fecha);
      setRepriceStatus('ok');
    } catch (e) {
      setRepriceStatus('error');
      setRepriceError(e instanceof Error ? e.message : 'Error al repricear');
    }
  };

  const noData = mark && !mark.hasIbr && !mark.hasSofr && !mark.hasNdf && !mark.hasTes;
  const hasAnyData = mark && (mark.hasIbr || mark.hasSofr || mark.hasNdf || mark.hasTes);

  return (
    <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 20 }}>
      {/* Header: date picker + nav + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#6c757d', fontWeight: 600 }}>Fecha:</span>
        <input
          type="date"
          value={fecha}
          min="2026-01-01"
          max={toLocalYMD(new Date())}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          style={{
            border: '1px solid #ced4da',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        />
        <button
          type="button"
          onClick={handlePrev}
          disabled={loading || fecha <= '2026-01-01'}
          style={navBtnStyle}
        >
          ◀
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={loading}
          style={navBtnStyle}
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setFecha(defaultFecha())}
          disabled={loading}
          style={{ ...navBtnStyle, fontSize: 11, padding: '3px 10px' }}
        >
          Ayer
        </button>

        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          <StatusChip label="IBR" ok={mark?.hasIbr ?? false} loading={loading} />
          <StatusChip label="SOFR" ok={mark?.hasSofr ?? false} loading={loading} />
          <StatusChip label="NDF" ok={mark?.hasNdf ?? false} loading={loading} />
          <StatusChip label="TES" ok={mark?.hasTes ?? false} loading={loading} />
        </div>
      </div>

      {/* No data state */}
      {noData && (
        <div style={emptyStyle}>
          Sin datos de mercado disponibles para {fecha}
        </div>
      )}

      {/* Sub-tabs */}
      {hasAnyData && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {SUB_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #dee2e6',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: subTab === t.key ? '#0d6efd' : '#fff',
                  color: subTab === t.key ? '#fff' : '#495057',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* IBR tab */}
          {subTab === 'ibr' && (
            loading ? (
              <div style={emptyStyle}>Cargando curva IBR…</div>
            ) : mark?.ibr ? (
              <>
                <div style={{ marginBottom: 4, fontSize: 11, color: '#6c757d' }}>
                  Fuente: Banrep (1d–12m) + DTCC swaps (2y–20y) — {fecha}
                </div>
                <IbrCurveChart ibr={mark.ibr} />
                <IbrNodeTable ibr={mark.ibr} />
              </>
            ) : (
              <div style={emptyStyle}>Sin datos IBR para {fecha}</div>
            )
          )}

          {/* SOFR tab */}
          {subTab === 'sofr' && (
            loading ? (
              <div style={emptyStyle}>Cargando curva SOFR…</div>
            ) : mark?.sofr && mark.sofr.length > 0 ? (
              <>
                <div style={{ marginBottom: 4, fontSize: 11, color: '#6c757d' }}>
                  Fuente: Fed (sofr_swap_curve) — {fecha}
                </div>
                <SofrCurveChart sofr={mark.sofr} />
                <table style={{ fontSize: 11, fontFamily: 'monospace', borderCollapse: 'collapse', marginTop: 8 }}>
                  <tbody>
                    <tr>
                      {mark.sofr.map((p) => (
                        <th key={p.tenor_months} style={thStyle}>
                          {SOFR_TENOR_LABEL[p.tenor_months] ?? `${p.tenor_months}M`}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {mark.sofr.map((p) => (
                        <td key={p.tenor_months} style={tdStyle}>{fmtPct(p.swap_rate)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <div style={emptyStyle}>Sin datos SOFR para {fecha}</div>
            )
          )}

          {/* NDF fwd pts tab */}
          {subTab === 'ndf' && (
            loading ? (
              <div style={emptyStyle}>Cargando NDF forward points…</div>
            ) : mark?.ndf && mark.ndf.length > 0 ? (
              <>
                <div style={{ marginBottom: 4, fontSize: 11, color: '#6c757d' }}>
                  Fuente: FXEmpire (cop_fwd_points) — {fecha}
                </div>
                <NdfFwdPtsChart ndf={mark.ndf} />
                <table style={{ fontSize: 11, fontFamily: 'monospace', borderCollapse: 'collapse', marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Tenor</th>
                      <th style={thStyle}>Fwd Pts</th>
                      <th style={thStyle}>Mid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mark.ndf.map((p) => (
                      <tr key={p.tenor}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{p.tenor}</td>
                        <td style={tdStyle}>{fmt2(p.fwd_points)}</td>
                        <td style={tdStyle}>{fmt2(p.mid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={emptyStyle}>Sin datos NDF para {fecha}</div>
            )
          )}

          {/* TES tab */}
          {subTab === 'tes' && (
            loading ? (
              <div style={emptyStyle}>Cargando curva TES…</div>
            ) : mark?.tes && mark.tes.length > 0 ? (
              <>
                <div style={{ marginBottom: 4, fontSize: 11, color: '#6c757d' }}>
                  Fuente: Banco de la República / SEN — {fecha}
                </div>
                <TesCurveChart tes={mark.tes} />
                <table style={{ fontSize: 11, fontFamily: 'monospace', borderCollapse: 'collapse', marginTop: 8, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Bono</th>
                      <th style={thStyle}>Vencimiento</th>
                      <th style={thStyle}>YTM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mark.tes]
                      .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date))
                      .map((p) => (
                        <tr key={p.name}>
                          <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'left' }}>{p.name}</td>
                          <td style={tdStyle}>{p.maturity_date.slice(0, 10)}</td>
                          <td style={tdStyle}>{fmtPct3(p.ytm)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={emptyStyle}>Sin datos TES para {fecha}</div>
            )
          )}

          {/* Reprice with this mark */}
          <div
            style={{
              marginTop: 20,
              padding: '10px 14px',
              background: '#f8f9fa',
              borderRadius: 6,
              border: '1px solid #dee2e6',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleReprice}
              disabled={repriceStatus === 'loading' || loading}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #0d6efd',
                background: repriceStatus === 'loading' ? '#e9ecef' : '#0d6efd',
                color: repriceStatus === 'loading' ? '#adb5bd' : '#fff',
                cursor: repriceStatus === 'loading' ? 'not-allowed' : 'pointer',
              }}
            >
              {repriceStatus === 'loading' ? 'Repreciando…' : 'Repricear portafolio con esta marca'}
            </button>
            {repriceStatus === 'ok' && (
              <span style={{ fontSize: 11, color: '#155724', fontWeight: 600 }}>
                Portafolio repreciado con marca del {fecha}
              </span>
            )}
            {repriceStatus === 'error' && (
              <span style={{ fontSize: 11, color: '#721c24' }}>
                Error: {repriceError}
              </span>
            )}
            {repriceStatus === 'idle' && (
              <span style={{ fontSize: 11, color: '#6c757d' }}>
                Repreciará todo el portafolio (derivados + TES) con curvas históricas del {fecha}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
