/* eslint-disable jsx-a11y/control-has-associated-label, jsx-a11y/no-autofocus */
/**
 * QuarterlyExposureTable — exposicion trimestral en USD para empresas
 * cuyo modelo de negocio es trimestral (importacion, cartas de credito,
 * cobertura de obligaciones USD).
 *
 * Inicialmente para Los Coches. La fila correspondiente al trimestre
 * actual (basado en `globalEvaluationDate`) se resalta — ese monto es
 * el que alimenta la "Exp Natural" del Benchmark.
 *
 * Cada fila se autosave 600ms despues del ultimo cambio. UI muestra
 * estado por fila: ● dirty, ⟳ saving, ✓ saved, ! error.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  fetchExposicionTrimestral,
  upsertExposicionTrimestral,
  QUARTER_LABEL,
  getQuarterFromDate,
  type ExposicionTrimestralRow,
} from 'src/models/risk/fetchExposicionTrimestral';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type LocalRow = ExposicionTrimestralRow & {
  saveState: SaveState;
  saveError?: string;
};

interface Props {
  companyId: string;
  year: number;
  /** filterDate global del modulo de Riesgos (YYYY-MM-DD). Determina Q actual. */
  evaluationDate: string;
  /** true para corp_admin/gestor/super_admin; false para lector. */
  canEdit?: boolean;
  /**
   * Callback opcional para notificar al parent cuando una fila se guarda.
   * Pasa el nuevo objeto fila (server-side) para que el parent mantenga
   * su cache de filas sincronizado (e.g. el feed al Benchmark fila USD).
   */
  onRowSaved?: (row: ExposicionTrimestralRow) => void;
}

const DEBOUNCE_MS = 600;

const fmtUsd = (v: number): string => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const fmtUsdFull = (v: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

// ── Save state indicator ───────────────────────────────────────────────

const SAVE_INDICATOR: Record<SaveState, { color: string; text: string }> = {
  idle:   { color: '#adb5bd', text: '' },
  dirty:  { color: '#f59e0b', text: '●' },
  saving: { color: '#3b82f6', text: '⟳' },
  saved:  { color: '#22c55e', text: '✓' },
  error:  { color: '#ef4444', text: '!' },
};

// ── Componente ──────────────────────────────────────────────────────────

const buildPlaceholderRows = (companyId: string, year: number): LocalRow[] =>
  [1, 2, 3, 4].map((q) => ({
    id: `pending-${q}`,
    company_id: companyId,
    year,
    quarter: q,
    exposicion_usd: 0,
    concepto: null,
    contraparte: null,
    fecha_vencimiento: null,
    notes: null,
    created_at: '',
    updated_at: '',
    saveState: 'idle' as SaveState,
  }));

export default function QuarterlyExposureTable({
  companyId,
  year,
  evaluationDate,
  canEdit = true,
  onRowSaved,
}: Props) {
  // Importante: arrancamos con las 4 filas placeholder Q1..Q4 listas
  // para edicion. El fetch solo las llena cuando llegan datos del
  // server. Si falla el fetch, igual ves los inputs y puedes guardar.
  const [rows, setRows] = useState<LocalRow[]>(() => buildPlaceholderRows(companyId, year));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const rowsRef = useRef<LocalRow[]>([]);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Mantener rowsRef sincronizado con state para que los closures de
  // debounce vean siempre el ultimo valor.
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const currentQuarter = useMemo(
    () => getQuarterFromDate(evaluationDate),
    [evaluationDate],
  );

  // ── Carga inicial: fetch + merge encima de las 4 filas placeholder ──
  useEffect(() => {
    let cancelled = false;
    setFetchError(null);
    // Reset placeholders al cambiar de empresa
    setRows(buildPlaceholderRows(companyId, year));

    fetchExposicionTrimestral(companyId, year).then((r) => {
      if (cancelled) return;
      if (r.error) {
        setFetchError(r.error);
        return;
      }
      if (r.data.length === 0) {
        // No hay filas todavia (seed no corrido) — se quedan los placeholders.
        return;
      }
      // Mergear: tomamos lo que vino del server y mantenemos placeholder
      // donde no hay data.
      const byQ: Record<number, ExposicionTrimestralRow> = {};
      r.data.forEach((row) => { byQ[row.quarter] = row; });
      setRows((prev) => prev.map((p) => {
        const existing = byQ[p.quarter];
        return existing ? { ...existing, saveState: 'idle' as SaveState } : p;
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, year]);

  // ── Save handler con debounce por trimestre ──
  const scheduleSave = useCallback((quarter: number) => {
    if (debounceRef.current[quarter]) {
      clearTimeout(debounceRef.current[quarter]);
    }
    debounceRef.current[quarter] = setTimeout(async () => {
      const target = rowsRef.current.find((r) => r.quarter === quarter);
      if (!target) return;
      setRows((prev) => prev.map((r) => (
        r.quarter === quarter ? { ...r, saveState: 'saving' } : r
      )));
      const result = await upsertExposicionTrimestral({
        company_id: companyId,
        year,
        quarter,
        exposicion_usd: target.exposicion_usd,
        concepto: target.concepto,
        contraparte: target.contraparte,
        fecha_vencimiento: target.fecha_vencimiento,
        notes: target.notes,
      });
      if (result.error) {
        setRows((prev) => prev.map((r) => (
          r.quarter === quarter
            ? { ...r, saveState: 'error', saveError: result.error }
            : r
        )));
        toast.error(`Q${quarter}: ${result.error}`);
        return;
      }
      setRows((prev) => prev.map((r) => (
        r.quarter === quarter
          ? { ...r, saveState: 'saved', id: result.id ?? r.id }
          : r
      )));
      // Notificar al parent del save exitoso para que mantenga sincronizado
      // su cache (e.g. el feed al Benchmark fila USD).
      if (onRowSaved) {
        const updated: ExposicionTrimestralRow = {
          id: result.id ?? target.id,
          company_id: companyId,
          year,
          quarter,
          exposicion_usd: target.exposicion_usd,
          concepto: target.concepto,
          contraparte: target.contraparte,
          fecha_vencimiento: target.fecha_vencimiento,
          notes: target.notes,
          created_at: target.created_at,
          updated_at: new Date().toISOString(),
        };
        onRowSaved(updated);
      }
      // Borrar el ✓ despues de 1.5s
      setTimeout(() => {
        setRows((prev) => prev.map((r) => (
          r.quarter === quarter && r.saveState === 'saved'
            ? { ...r, saveState: 'idle' }
            : r
        )));
      }, 1500);
    }, DEBOUNCE_MS);
  }, [companyId, year, onRowSaved]);

  const updateField = useCallback((
    quarter: number,
    field: keyof Pick<LocalRow, 'exposicion_usd' | 'concepto' | 'contraparte' | 'fecha_vencimiento' | 'notes'>,
    value: number | string | null,
  ) => {
    setRows((prev) => prev.map((r) => {
      if (r.quarter !== quarter) return r;
      return { ...r, [field]: value, saveState: 'dirty' };
    }));
    scheduleSave(quarter);
  }, [scheduleSave]);

  const totalUsd = useMemo(
    () => rows.reduce((s, r) => s + (r.exposicion_usd ?? 0), 0),
    [rows],
  );

  const currentQuarterUsd = useMemo(() => {
    const row = rows.find((r) => r.quarter === currentQuarter);
    return row?.exposicion_usd ?? 0;
  }, [rows, currentQuarter]);

  return (
    <div>
      {fetchError && (
        <div style={{
          marginBottom: 12,
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#991b1b',
          fontSize: 12,
        }}
        >
          <strong>No se pudo cargar la exposicion guardada:</strong> {fetchError}
          <div style={{ marginTop: 4, color: '#7f1d1d' }}>
            Asegurate de que el SQL <code>scripts/exposicion_trimestral_setup.sql</code> esta
            corrido en Supabase. Igual puedes editar abajo — los cambios se intentaran guardar.
          </div>
        </div>
      )}
      {/* Header con metrica destacada */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
        borderRadius: 8,
        border: '1px solid #e0e7ff',
      }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Exposicion Anual {year}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e1b4b', fontFamily: 'monospace', marginTop: 4 }}>
            {fmtUsdFull(totalUsd)} USD
          </div>
        </div>
        <div style={{ width: 1, background: '#c7d2fe' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Q Actual (Q{currentQuarter}) · → Benchmark
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#14532d', fontFamily: 'monospace', marginTop: 4 }}>
            {fmtUsdFull(currentQuarterUsd)} USD
          </div>
        </div>
      </div>

      {/* Grid de 4 trimestres como tarjetas — clean, sin metadata extra */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}
      >
        {rows.map((row) => {
          const isCurrent = row.quarter === currentQuarter;
          const indicator = SAVE_INDICATOR[row.saveState];
          return (
            <div
              key={row.quarter}
              style={{
                background: '#fff',
                border: isCurrent ? '2px solid #22c55e' : '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '14px 16px',
                position: 'relative',
                transition: 'border-color 150ms ease, box-shadow 150ms ease',
                boxShadow: isCurrent ? '0 4px 12px rgba(34, 197, 94, 0.08)' : 'none',
              }}
            >
              {/* Header: Trimestre + badge ACTUAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    {`Q${row.quarter}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, letterSpacing: '0.02em', marginTop: 1 }}>
                    {QUARTER_LABEL[row.quarter].replace(/^Q\d+ /, '').replace(/[()]/g, '')}
                  </div>
                </div>
                {isCurrent && (
                  <span style={{
                    fontSize: 9,
                    padding: '3px 7px',
                    borderRadius: 4,
                    background: '#22c55e',
                    color: '#fff',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                  >
                    Actual
                  </span>
                )}
              </div>

              {/* Input */}
              <div style={{ position: 'relative', marginTop: 14 }}>
                <span style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14,
                  color: '#94a3b8',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}
                >
                  $
                </span>
                <input
                  type="number"
                  step={1}
                  disabled={!canEdit}
                  value={row.exposicion_usd === 0 ? '' : row.exposicion_usd}
                  placeholder="0"
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : Number(e.target.value);
                    updateField(row.quarter, 'exposicion_usd', Number.isFinite(v) ? v : 0);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 22px',
                    fontSize: 17,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    textAlign: 'right',
                    color: row.exposicion_usd < 0 ? '#dc2626' : '#0f172a',
                    background: canEdit ? '#fff' : '#f8fafc',
                  }}
                />
              </div>

              {/* Footer: formato compacto + save state */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
                <span style={{
                  color: row.exposicion_usd < 0 ? '#dc2626' : '#64748b',
                  fontFamily: 'monospace',
                  fontWeight: row.exposicion_usd < 0 ? 600 : 400,
                }}
                >
                  {fmtUsd(row.exposicion_usd)} USD
                </span>
                <span
                  style={{ color: indicator.color, fontWeight: 700, fontSize: 14, minWidth: 14, textAlign: 'right' }}
                  title={row.saveError ?? row.saveState}
                >
                  {indicator.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helper text */}
      <div style={{
        marginTop: 14,
        fontSize: 11,
        color: '#475569',
        padding: '10px 14px',
        background: '#f8fafc',
        borderLeft: '3px solid #6366f1',
        borderRadius: 4,
        lineHeight: 1.5,
      }}
      >
        La exposicion es la <strong>posicion natural en USD</strong> de la empresa por trimestre (no
        incluye coberturas con forwards). <strong>Positivo = largo USD</strong> (cuentas por cobrar,
        exportaciones). <strong>Negativo = corto USD</strong> (cuentas por pagar, importaciones).
        El monto del <strong>trimestre actual</strong> (Q{currentQuarter}) alimenta la fila USD
        <strong>Exposicion Natural</strong> del Benchmark — se ajusta automaticamente al cruzar
        borde de trimestre con el filtro global.
      </div>
    </div>
  );
}
