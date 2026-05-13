import React, { useEffect } from 'react';
import useAppStore from 'src/store';
import { CPISnapshot } from 'src/types/inflation';
import {
  KpiGrid,
  KpiCard,
  KpiLabel,
  KpiValue,
  KpiDelta,
  KpiSubtle,
} from './styled';

const TOTAL_ID = 1;
const BANREP_TARGET = 3;
const BANREP_TOL = 1;

const fmtPct = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

const fmtMonthYear = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

const arrowTone = (delta: number | null | undefined) => {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return 'neutral';
  return delta > 0 ? 'positive' : 'negative';
};

const arrow = (delta: number | null | undefined) => {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '';
  if (Math.abs(delta) < 0.005) return '·';
  return delta > 0 ? '▲' : '▼';
};

const targetTone = (yoy: number | null | undefined) => {
  if (yoy === null || yoy === undefined || Number.isNaN(yoy)) return 'neutral';
  if (yoy > BANREP_TARGET + BANREP_TOL) return 'positive';
  if (yoy < BANREP_TARGET - BANREP_TOL) return 'negative';
  return 'neutral';
};

const targetLabel = (yoy: number | null | undefined) => {
  if (yoy === null || yoy === undefined || Number.isNaN(yoy)) return '—';
  if (yoy > BANREP_TARGET + BANREP_TOL) return `+${(yoy - (BANREP_TARGET + BANREP_TOL)).toFixed(2)} pp sobre el techo`;
  if (yoy < BANREP_TARGET - BANREP_TOL) return `${((BANREP_TARGET - BANREP_TOL) - yoy).toFixed(2)} pp bajo el piso`;
  return 'dentro del rango';
};

export default function InflationKPIs() {
  const snapshot = useAppStore((s) => s.snapshotByCanasta[TOTAL_ID]) as CPISnapshot | undefined;
  const loadCanastaSnapshot = useAppStore((s) => s.loadCanastaSnapshot);

  useEffect(() => {
    loadCanastaSnapshot(TOTAL_ID);
  }, [loadCanastaSnapshot]);

  const yoy = snapshot?.last_yoy ?? null;
  const yoyDelta =
    snapshot && snapshot.last_yoy !== null && snapshot.prev_yoy !== null
      ? snapshot.last_yoy - snapshot.prev_yoy
      : null;
  const mom = snapshot?.last_mom ?? null;
  const ytd = snapshot?.last_ytd ?? null;

  return (
    <KpiGrid>
      <KpiCard>
        <KpiLabel>IPC anual (YoY)</KpiLabel>
        <KpiValue tone={arrowTone(yoy)}>{fmtPct(yoy)}</KpiValue>
        <KpiDelta tone={arrowTone(yoyDelta)}>
          {arrow(yoyDelta)} {fmtPct(yoyDelta, 2)} vs mes anterior
        </KpiDelta>
        <KpiSubtle>{fmtMonthYear(snapshot?.last_date ?? null)}</KpiSubtle>
      </KpiCard>

      <KpiCard>
        <KpiLabel>IPC mensual (MoM)</KpiLabel>
        <KpiValue tone={arrowTone(mom)}>{fmtPct(mom)}</KpiValue>
        <KpiDelta tone="neutral">Variación punta a punta del mes</KpiDelta>
        <KpiSubtle>{fmtMonthYear(snapshot?.last_date ?? null)}</KpiSubtle>
      </KpiCard>

      <KpiCard>
        <KpiLabel>Año corrido (YTD)</KpiLabel>
        <KpiValue tone={arrowTone(ytd)}>{fmtPct(ytd)}</KpiValue>
        <KpiDelta tone="neutral">Acumulado desde enero</KpiDelta>
        <KpiSubtle>Cierre {fmtMonthYear(snapshot?.last_date ?? null)}</KpiSubtle>
      </KpiCard>

      <KpiCard>
        <KpiLabel>Meta Banrep 3% ±1%</KpiLabel>
        <KpiValue tone={targetTone(yoy)}>{fmtPct(yoy)}</KpiValue>
        <KpiDelta tone={targetTone(yoy)}>{targetLabel(yoy)}</KpiDelta>
        <KpiSubtle>Rango objetivo: 2% – 4%</KpiSubtle>
      </KpiCard>
    </KpiGrid>
  );
}
