'use client';

import React, { useState, useEffect } from 'react';
import { CoreLayout } from '@layout';
import Container from 'react-bootstrap/Container';
import PageTitle from '@components/PageTitle';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getMarks, type MarketMarkRow } from 'src/models/pricing/pricingApi';
import styles from './marks.module.css';

const PAGE_TITLE = 'Marcas de Mercado';

// ── Formatters ──────────────────────────────────────────────

function fmtNum(v: number | null | undefined, d: number): string {
  if (v == null || Number.isNaN(v)) return '--';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const fmtFx  = (v: number | null | undefined) => fmtNum(v, 2);
const fmtPct = (v: number | null | undefined, d = 3) =>
  v == null || Number.isNaN(v) ? '--' : `${fmtNum(v, d)}%`;
const fmtNdf = (v: number | null | undefined) => fmtNum(v, 2);

// ── Calendar helpers ─────────────────────────────────────────

function isWeekend(d: Date) { const wd = d.getDay(); return wd === 0 || wd === 6; }

function businessDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (!isWeekend(d)) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Tenor definitions for detail panel ──────────────────────

const IBR_TENORS = [
  { key: 'ibr_1d',  label: 'O/N' },
  { key: 'ibr_1m',  label: '1m'  },
  { key: 'ibr_3m',  label: '3m'  },
  { key: 'ibr_6m',  label: '6m'  },
  { key: 'ibr_12m', label: '1y'  },
  { key: 'ibr_2y',  label: '2y'  },
  { key: 'ibr_5y',  label: '5y'  },
  { key: 'ibr_10y', label: '10y' },
] as const;

const SOFR_TENORS = [
  { key: '1',   label: '1m'  },
  { key: '3',   label: '3m'  },
  { key: '6',   label: '6m'  },
  { key: '12',  label: '1y'  },
  { key: '18',  label: '18m' },
  { key: '24',  label: '2y'  },
  { key: '36',  label: '3y'  },
  { key: '60',  label: '5y'  },
  { key: '84',  label: '7y'  },
  { key: '120', label: '10y' },
  { key: '180', label: '15y' },
  { key: '240', label: '20y' },
  { key: '360', label: '30y' },
  { key: '480', label: '40y' },
  { key: '600', label: '50y' },
] as const;
const NDF_TENORS  = [
  { key: '1', label: '1m' }, { key: '3', label: '3m' },
  { key: '6', label: '6m' }, { key: '12', label: '1y' },
] as const;

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAY_LABELS  = ['L','M','X','J','V'];

// ── Chart data builders ──────────────────────────────────────
// X axis is always numeric months for correct curve shape.

const IBR_CHART_POINTS = [
  { months: 0.03, key: 'ibr_1d',  label: 'O/N' },
  { months: 1,    key: 'ibr_1m',  label: '1m'  },
  { months: 3,    key: 'ibr_3m',  label: '3m'  },
  { months: 6,    key: 'ibr_6m',  label: '6m'  },
  { months: 12,   key: 'ibr_12m', label: '1y'  },
  { months: 24,   key: 'ibr_2y',  label: '2y'  },
  { months: 60,   key: 'ibr_5y',  label: '5y'  },
  { months: 120,  key: 'ibr_10y', label: '10y' },
] as const;

const SOFR_CHART_POINTS = [
  { months: 1,   label: '1m'  },
  { months: 3,   label: '3m'  },
  { months: 6,   label: '6m'  },
  { months: 12,  label: '1y'  },
  { months: 18,  label: '18m' },
  { months: 24,  label: '2y'  },
  { months: 36,  label: '3y'  },
  { months: 60,  label: '5y'  },
  { months: 84,  label: '7y'  },
  { months: 120, label: '10y' },
  { months: 180, label: '15y' },
  { months: 240, label: '20y' },
  { months: 360, label: '30y' },
] as const;

const NDF_CHART_POINTS = [
  { months: 1,  label: '1m' },
  { months: 3,  label: '3m' },
  { months: 6,  label: '6m' },
  { months: 12, label: '1y' },
] as const;

function buildIbrData(row: MarketMarkRow) {
  return IBR_CHART_POINTS
    .map((p) => ({ months: p.months, label: p.label, rate: row.ibr?.[p.key] ?? null }))
    .filter((p) => p.rate !== null);
}

function buildSofrData(row: MarketMarkRow) {
  return SOFR_CHART_POINTS
    .map((p) => ({ months: p.months, label: p.label, rate: row.sofr?.[String(p.months)] ?? null }))
    .filter((p) => p.rate !== null);
}

function buildNdfData(row: MarketMarkRow, fxSpot: number | null) {
  return NDF_CHART_POINTS
    .map((p) => ({
      months: p.months,
      label: p.label,
      fwd: row.ndf?.[String(p.months)]?.F_market ?? null,
      spot: fxSpot,
    }))
    .filter((p) => p.fwd !== null);
}

// ── Component ───────────────────────────────────────────────

export function MarksContent({
  selectedDate,
  onSelectDate,
}: {
  selectedDate?: string | null;
  onSelectDate?: (fecha: string) => void;
} = {}) {
  const [rows, setRows]       = useState<MarketMarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const selected = selectedDate !== undefined ? selectedDate : internalSelected;
  const setSelected = (ymd: string) => {
    setInternalSelected(ymd);
    onSelectDate?.(ymd);
  };

  useEffect(() => {
    getMarks()
      .then((res) => { setRows(res.marks); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  const byDate = Object.fromEntries(rows.map((r) => [r.fecha, r]));
  const detail = selected ? byDate[selected] : null;

  // Build months to display: from earliest mark month to today
  const today = new Date();
  const todayYMD = toYMD(today);
  const months: { year: number; month: number }[] = [];
  if (rows.length > 0) {
    const earliest = new Date(rows[rows.length - 1].fecha + 'T12:00:00');
    const cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cur <= end) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  if (loading) return <p className={styles.muted}>Cargando marcas...</p>;
  if (error)   return <p className={styles.danger}>Error: {error}</p>;

  return (
    <div>
        {/* ── Main area: calendar + detail ── */}
        <div className={styles.mainArea}>

          {/* Calendar grid */}
          <div className={styles.calendarSection}>
            <div className={styles.sectionTitle}>Cobertura de Marcas</div>
            <div className={styles.legendRow}>
              <span className={`${styles.legendDot} ${styles.dotComplete}`} /> Completo
              <span className={`${styles.legendDot} ${styles.dotPartial}`} />  Parcial
              <span className={`${styles.legendDot} ${styles.dotMissing}`} />  Sin marca
              <span className={`${styles.legendDot} ${styles.dotSelected}`} /> Seleccionado
            </div>

            <div className={styles.monthsGrid}>
              {months.map(({ year, month }) => {
                const days = businessDaysInMonth(year, month);
                // Find what weekday (Mon=0..Fri=4) each day falls on
                return (
                  <div key={`${year}-${month}`} className={styles.monthBlock}>
                    <div className={styles.monthLabel}>{MONTH_NAMES[month]} {year}</div>
                    <div className={styles.calGrid}>
                      {DAY_LABELS.map((d) => (
                        <div key={d} className={styles.calDayLabel}>{d}</div>
                      ))}
                      {days.map((d) => {
                        const ymd  = toYMD(d);
                        const wd   = d.getDay(); // 1=Mon..5=Fri
                        const col  = wd; // CSS grid col 1-5
                        const row  = byDate[ymd];
                        const future = ymd > todayYMD;
                        let dotClass = styles.dotMissing;
                        if (future)                     dotClass = styles.dotFuture;
                        else if (row?.status === 'complete') dotClass = styles.dotComplete;
                        else if (row?.status === 'partial')  dotClass = styles.dotPartial;

                        const colClass = styles[`col${col}` as keyof typeof styles];
                        return (
                          <button
                            key={ymd}
                            type="button"
                            className={`${styles.calDay} ${dotClass} ${colClass} ${selected === ymd ? styles.dotSelected : ''}`}
                            title={ymd}
                            onClick={() => setSelected(ymd)}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>
              {selected ?? 'Selecciona un día'}
              {detail && (
                <span className={`${styles.statusBadge} ${styles[`badge_${detail.status}`]}`}>
                  {detail.status}
                </span>
              )}
            </div>

            {!selected && (
              <p className={styles.muted}>Selecciona un día en el calendario.</p>
            )}

            {detail && (
              <div className={styles.detailColumns}>
                {/* Col 1: Spot + NDF stacked */}
                <div className={styles.detailStack}>
                  <div className={styles.detailGroup}>
                    <div className={styles.detailGroupTitle}>Spot & Overnight</div>
                    <DetailRow label="FX Spot"  value={fmtFx(detail.fx_spot)} />
                    <DetailRow label="SOFR O/N" value={fmtPct(detail.sofr_on, 2)} />
                    <DetailRow label="IBR O/N"  value={fmtPct(detail.ibr?.ibr_1d)} />
                  </div>
                  <div className={styles.detailGroup}>
                    <div className={styles.detailGroupTitle}>NDF F_market (USD/COP)</div>
                    {NDF_TENORS.map((t) => (
                      <DetailRow key={t.key} label={t.label} value={fmtNdf(detail.ndf?.[t.key]?.F_market)} />
                    ))}
                  </div>
                </div>

                {/* Col 2: IBR */}
                <div className={styles.detailGroup}>
                  <div className={styles.detailGroupTitle}>IBR (%)</div>
                  {IBR_TENORS.map((t) => (
                    <DetailRow key={t.key} label={t.label} value={fmtPct(detail.ibr?.[t.key])} />
                  ))}
                </div>

                {/* Col 3: SOFR */}
                <div className={styles.detailGroup}>
                  <div className={styles.detailGroupTitle}>SOFR Swap (%)</div>
                  {SOFR_TENORS.map((t) => (
                    <DetailRow key={t.key} label={t.label} value={fmtPct(detail.sofr?.[t.key])} />
                  ))}
                </div>
              </div>
            )}

            {selected && !detail && (
              <div className={styles.missingDay}>
                <span className={styles.missingIcon}>⚠</span>
                <p>No hay marca para este día hábil.</p>
                <p className={styles.muted}>Ejecuta el backfill para cubrir este gap.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Curve charts ── */}
        {detail && (
          <div className={styles.chartsRow}>
            <CurveChart
              title="IBR (%)"
              data={buildIbrData(detail)}
              xKey="months"
              yKey="rate"
              color="#6366f1"
              yDomain={['auto', 'auto']}
              tickFormatter={(m: number) => IBR_CHART_POINTS.find((p) => p.months === m)?.label ?? `${m}m`}
              ticks={IBR_CHART_POINTS.map((p) => p.months)}
              tooltipFormatter={(v: number) => [`${v.toFixed(3)}%`, 'IBR']}
            />
            <CurveChart
              title="SOFR Swap (%)"
              data={buildSofrData(detail)}
              xKey="months"
              yKey="rate"
              color="#10b981"
              yDomain={['auto', 'auto']}
              tickFormatter={(m: number) => SOFR_CHART_POINTS.find((p) => p.months === m)?.label ?? `${m}m`}
              ticks={SOFR_CHART_POINTS.map((p) => p.months)}
              tooltipFormatter={(v: number) => [`${v.toFixed(3)}%`, 'SOFR']}
            />
            <CurveChart
              title="NDF F_market (USD/COP)"
              data={buildNdfData(detail, detail.fx_spot)}
              xKey="months"
              yKey="fwd"
              color="#f59e0b"
              yDomain={['auto', 'auto']}
              tickFormatter={(m: number) => NDF_CHART_POINTS.find((p) => p.months === m)?.label ?? `${m}m`}
              ticks={NDF_CHART_POINTS.map((p) => p.months)}
              tooltipFormatter={(v: number) => [v.toFixed(2), 'F_market']}
              referenceLine={detail.fx_spot ?? undefined}
              referenceLabel="Spot"
            />
          </div>
        )}
    </div>
  );
}

export default function MarksPage() {
  return (
    <CoreLayout>
      <Container fluid className="p-4">
        <PageTitle name={PAGE_TITLE} />
        <MarksContent />
      </Container>
    </CoreLayout>
  );
}

// ── Sub-components ───────────────────────────────────────────

interface CurveChartProps {
  title: string;
  data: Record<string, number | string | null | undefined>[];
  xKey: string;
  yKey: string;
  color: string;
  yDomain: [number | string, number | string];
  tickFormatter: (v: number) => string;
  ticks: readonly number[];
  tooltipFormatter: (v: number) => [string, string];
  referenceLine?: number;
  referenceLabel?: string;
}

function CurveChart({
  title, data, xKey, yKey, color, yDomain,
  tickFormatter, ticks, tooltipFormatter, referenceLine, referenceLabel,
}: CurveChartProps) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eaf0" />
          <XAxis
            dataKey={xKey}
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            ticks={[...ticks]}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={{ stroke: '#e8eaf0' }}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{ fontSize: 11, border: '1px solid #e8eaf0', borderRadius: 4 }}
            labelFormatter={(v: number) => tickFormatter(v)}
          />
          {referenceLine != null && (
            <ReferenceLine
              y={referenceLine}
              stroke="#9ca3af"
              strokeDasharray="4 2"
              label={{ value: referenceLabel, fontSize: 9, fill: '#9ca3af', position: 'insideTopRight' }}
            />
          )}
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const missing = value === '--';
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={missing ? styles.detailMissing : styles.detailValue}>{value}</span>
    </div>
  );
}
