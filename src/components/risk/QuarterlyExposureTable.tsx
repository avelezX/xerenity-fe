/* eslint-disable jsx-a11y/control-has-associated-label, jsx-a11y/no-autofocus */
/**
 * QuarterlyExposureTable — exposicion trimestral multi-entrada con TRM
 * por linea. Cada Q puede tener N entradas (cada CxP / CxC con su fecha
 * y TRM propia). El total del Q en COP se calcula como Σ (usd × trm).
 *
 * Diseño (jul 2026):
 *   - Banner superior con exposicion anual total (USD + COP).
 *   - 4 cards (Q1-Q4) con tabla interna: Fecha, Concepto, TRM, USD, COP.
 *   - Fila "+ Nueva entrada" al final de cada card.
 *   - Subtotal por Q (USD + COP), Q actual con borde verde + badge.
 *   - Autosave 600ms por fila, indicador ● ⟳ ✓ !.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  fetchExposicionTrimestral,
  upsertExposicionTrimestral,
  deleteExposicionTrimestral,
  QUARTER_LABEL,
  getQuarterFromDate,
  type ExposicionTrimestralRow,
} from 'src/models/risk/fetchExposicionTrimestral';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type LocalRow = ExposicionTrimestralRow & {
  saveState: SaveState;
  saveError?: string;
  isDraft?: boolean; // true = aun no persistida (INSERT pendiente)
};

interface Props {
  companyId: string;
  year: number;
  evaluationDate: string;
  canEdit?: boolean;
  /**
   * Callback opcional para notificar cuando cambian los datos (add/update/
   * delete). El parent usa esto para refrescar el USD row del Benchmark.
   */
  onDataChanged?: (rows: ExposicionTrimestralRow[]) => void;
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

const fmtCop = (v: number): string => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`;
};

const fmtNum = (v: number, dec = 0): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);

const signColor = (v: number, neg: string, pos: string, zero: string): string => {
  if (v < 0) return neg;
  if (v > 0) return pos;
  return zero;
};

// ── Palette ──────────────────────────────────────────────────────

const COLORS = {
  ink:          '#0f172a',
  inkMuted:     '#475569',
  inkSubtle:    '#94a3b8',
  border:       '#e2e8f0',
  borderLight:  '#f1f5f9',
  bg:           '#f8fafc',
  bgCard:       '#ffffff',
  accent:       '#7c3aed',
  accentSoft:   '#faf5ff',
  actual:       '#059669',
  actualBg:     '#ecfdf5',
  pos:          '#15803d',
  neg:          '#b91c1c',
  drop:         '#dc2626',
};

const SAVE_INDICATOR: Record<SaveState, { color: string; text: string; title: string }> = {
  idle:   { color: 'transparent', text: '',  title: '' },
  dirty:  { color: '#f59e0b',     text: '●', title: 'Pendiente — guardando en 0.6s' },
  saving: { color: '#3b82f6',     text: '⟳', title: 'Guardando…' },
  saved:  { color: '#22c55e',     text: '✓', title: 'Guardado' },
  error:  { color: '#ef4444',     text: '!', title: 'Error al guardar' },
};

// ── Styles ────────────────────────────────────────────────────────

const S = {
  banner: {
    background: 'linear-gradient(135deg, #faf5ff 0%, #f0fdf4 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '18px 22px',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 20,
  },
  bannerLabel: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: COLORS.accent,
    fontWeight: 700,
    marginBottom: 4,
  },
  bannerValue: {
    fontSize: 26,
    fontWeight: 700,
    fontFamily: 'ui-monospace, monospace',
    color: COLORS.ink,
    letterSpacing: '-0.01em',
  },
  bannerSubValue: {
    fontSize: 13,
    fontFamily: 'ui-monospace, monospace',
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: 14,
  },
  card: {
    background: COLORS.bgCard,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    overflow: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  cardActual: {
    border: `2px solid ${COLORS.actual}`,
    boxShadow: `0 4px 12px ${COLORS.actual}18`,
  },
  cardHeader: {
    padding: '10px 14px',
    background: COLORS.bg,
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.ink,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardSub: {
    fontSize: 10,
    color: COLORS.inkMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  actualBadge: {
    fontSize: 9,
    padding: '2px 7px',
    borderRadius: 4,
    background: COLORS.actual,
    color: '#fff',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  th: {
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: COLORS.inkMuted,
    fontWeight: 700,
    padding: '8px 8px',
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.bg,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  },
  thNum: {
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: COLORS.inkMuted,
    fontWeight: 700,
    padding: '8px 8px',
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.bg,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    fontSize: 12,
    padding: '4px 6px',
    borderBottom: `1px solid ${COLORS.borderLight}`,
    verticalAlign: 'middle' as const,
  },
  input: {
    width: '100%',
    fontSize: 12,
    padding: '4px 6px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    fontFamily: 'ui-monospace, monospace',
    background: '#fff',
    color: COLORS.ink,
    outline: 'none',
  },
  inputText: {
    width: '100%',
    fontSize: 12,
    padding: '4px 6px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    background: '#fff',
    color: COLORS.ink,
    outline: 'none',
  },
  copCell: {
    fontSize: 11,
    padding: '4px 6px',
    borderBottom: `1px solid ${COLORS.borderLight}`,
    verticalAlign: 'middle' as const,
    textAlign: 'right' as const,
    fontFamily: 'ui-monospace, monospace',
    color: COLORS.inkMuted,
  },
  emptyRow: {
    fontSize: 11,
    color: COLORS.inkSubtle,
    fontStyle: 'italic' as const,
    padding: '12px 8px',
    textAlign: 'center' as const,
  },
  addBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: `1px dashed ${COLORS.accent}`,
    borderRadius: 6,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 6,
  },
  addBtnActual: {
    borderColor: COLORS.actual,
    color: COLORS.actual,
  },
  addBtnDisabled: {
    borderColor: COLORS.border,
    color: COLORS.inkSubtle,
    cursor: 'not-allowed',
  },
  subtotal: {
    padding: '10px 14px',
    background: COLORS.bg,
    borderTop: `1px solid ${COLORS.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 11,
  },
  subtotalLabel: {
    color: COLORS.inkMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 700,
    fontSize: 10,
  },
  subtotalValue: {
    fontFamily: 'ui-monospace, monospace',
    fontWeight: 700,
    fontSize: 13,
  },
  subtotalCop: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    color: COLORS.inkMuted,
  },
  delBtn: {
    background: 'transparent',
    border: 'none',
    color: COLORS.drop,
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
    lineHeight: 1,
    borderRadius: 3,
  },
  saveIndicator: {
    display: 'inline-block',
    width: 12,
    fontSize: 12,
    textAlign: 'center' as const,
    lineHeight: 1,
  },
  hint: {
    background: '#fefce8',
    border: '1px solid #facc15',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 11,
    color: '#713f12',
    marginTop: 12,
  },
};

// ── Component ─────────────────────────────────────────────────────

export default function QuarterlyExposureTable({
  companyId,
  year,
  evaluationDate,
  canEdit = true,
  onDataChanged,
}: Props) {
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const rowsRef = useRef<LocalRow[]>([]);
  const draftCounterRef = useRef<number>(0);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const currentQuarter = useMemo(
    () => getQuarterFromDate(evaluationDate),
    [evaluationDate],
  );

  useEffect(() => {
    let cancelled = false;
    setFetchError(null);
    setLoading(true);

    fetchExposicionTrimestral(companyId, year).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.error) {
        setFetchError(r.error);
        setRows([]);
        return;
      }
      const local: LocalRow[] = r.data.map((row) => ({ ...row, saveState: 'idle' as SaveState }));
      setRows(local);
      onDataChanged?.(r.data);
    });

    return () => {
      cancelled = true;
      Object.values(debounceRef.current).forEach(clearTimeout);
      debounceRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, year]);

  const notifyChanged = useCallback(() => {
    const current: ExposicionTrimestralRow[] = rowsRef.current
      .filter((r) => !r.isDraft || (r.exposicion_usd || 0) !== 0 || r.trm != null)
      .map(({ saveState, saveError, isDraft, ...rest }) => rest);
    onDataChanged?.(current);
  }, [onDataChanged]);

  const persistRow = useCallback(async (localId: string) => {
    const row = rowsRef.current.find((r) => r.id === localId);
    if (!row) return;

    setRows((prev) => prev.map((r) => (r.id === localId ? { ...r, saveState: 'saving' } : r)));

    const payload = {
      id: row.isDraft ? undefined : row.id,
      company_id: row.company_id,
      year: row.year,
      quarter: row.quarter,
      exposicion_usd: row.exposicion_usd,
      trm: row.trm,
      concepto: row.concepto,
      contraparte: row.contraparte,
      fecha_vencimiento: row.fecha_vencimiento,
      notes: row.notes,
    };

    const res = await upsertExposicionTrimestral(payload);
    if (res.error) {
      setRows((prev) => prev.map((r) => (
        r.id === localId ? { ...r, saveState: 'error', saveError: res.error } : r
      )));
      toast.error(`Error al guardar: ${res.error}`);
      return;
    }

    // Si era draft, cambiar el localId al server id.
    setRows((prev) => prev.map((r) => (
      r.id === localId
        ? {
          ...r,
          id: res.id ?? r.id,
          isDraft: false,
          saveState: 'saved' as SaveState,
          saveError: undefined,
        }
        : r
    )));
    notifyChanged();

    // Reset indicator despues de 1.5s
    setTimeout(() => {
      setRows((prev) => prev.map((r) => (
        (r.id === localId || r.id === res.id) && r.saveState === 'saved'
          ? { ...r, saveState: 'idle' as SaveState }
          : r
      )));
    }, 1500);
  }, [notifyChanged]);

  const scheduleSave = useCallback((localId: string) => {
    const existing = debounceRef.current[localId];
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      delete debounceRef.current[localId];
      persistRow(localId);
    }, DEBOUNCE_MS);
    debounceRef.current[localId] = timer;
  }, [persistRow]);

  const patchRow = useCallback((localId: string, patch: Partial<LocalRow>) => {
    setRows((prev) => prev.map((r) => (
      r.id === localId ? { ...r, ...patch, saveState: 'dirty' as SaveState } : r
    )));
    scheduleSave(localId);
  }, [scheduleSave]);

  const flushRow = useCallback((localId: string) => {
    const t = debounceRef.current[localId];
    if (t) {
      clearTimeout(t);
      delete debounceRef.current[localId];
      persistRow(localId);
    }
  }, [persistRow]);

  const addRow = useCallback((quarter: number) => {
    if (!canEdit) return;
    // Contador monotonico garantiza unicidad — evita cualquier colision
    // que causaria compartir estado de input entre filas por React key clash.
    draftCounterRef.current += 1;
    const draftId = `draft-${draftCounterRef.current}`;
    const draft: LocalRow = {
      id: draftId,
      company_id: companyId,
      year,
      quarter,
      exposicion_usd: 0,
      trm: null,
      concepto: null,
      contraparte: null,
      fecha_vencimiento: null,
      notes: null,
      created_at: '',
      updated_at: '',
      saveState: 'dirty',
      isDraft: true,
    };
    setRows((prev) => [...prev, draft]);
  }, [canEdit, companyId, year]);

  const deleteRow = useCallback(async (localId: string) => {
    if (!canEdit) return;
    const row = rowsRef.current.find((r) => r.id === localId);
    if (!row) return;

    // eslint-disable-next-line no-alert
    if (!window.confirm('¿Borrar esta entrada?')) return;

    if (row.isDraft) {
      // No fue persistida, solo removerla del state.
      setRows((prev) => prev.filter((r) => r.id !== localId));
      return;
    }

    const res = await deleteExposicionTrimestral(row.id);
    if (res.error) {
      toast.error(`Error al borrar: ${res.error}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== localId));
    notifyChanged();
  }, [canEdit, notifyChanged]);

  // ── Agregados ─────────────────────────────────────────────────

  const byQuarter = useMemo(() => {
    const acc: Record<number, LocalRow[]> = { 1: [], 2: [], 3: [], 4: [] };
    rows.forEach((r) => { if (r.quarter >= 1 && r.quarter <= 4) acc[r.quarter].push(r); });
    return acc;
  }, [rows]);

  const totalUsd = useMemo(
    () => rows.reduce((s, r) => s + (r.exposicion_usd || 0), 0),
    [rows],
  );
  const totalCop = useMemo(
    () => rows.reduce((s, r) => s + (r.exposicion_usd || 0) * (r.trm || 0), 0),
    [rows],
  );
  const currentQuarterUsd = useMemo(
    () => byQuarter[currentQuarter].reduce((s, r) => s + (r.exposicion_usd || 0), 0),
    [byQuarter, currentQuarter],
  );
  const currentQuarterCop = useMemo(
    () => byQuarter[currentQuarter].reduce(
      (s, r) => s + (r.exposicion_usd || 0) * (r.trm || 0),
      0,
    ),
    [byQuarter, currentQuarter],
  );

  const anyMissingTrm = useMemo(
    () => rows.some((r) => (r.exposicion_usd || 0) !== 0 && (r.trm ?? 0) === 0),
    [rows],
  );

  // ── Render ────────────────────────────────────────────────────

  const renderQuarterCard = (q: 1 | 2 | 3 | 4) => {
    const items = byQuarter[q];
    const isCurrent = q === currentQuarter;
    const subUsd = items.reduce((s, r) => s + (r.exposicion_usd || 0), 0);
    const subCop = items.reduce((s, r) => s + (r.exposicion_usd || 0) * (r.trm || 0), 0);

    return (
      <div key={q} style={{ ...S.card, ...(isCurrent ? S.cardActual : {}) }}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>
            <span>{QUARTER_LABEL[q]?.split(' ')[0] || `Q${q}`}</span>
            <span style={S.cardSub}>{QUARTER_LABEL[q]?.split('(')[1]?.replace(')', '') || ''}</span>
            {isCurrent && <span style={S.actualBadge}>Actual</span>}
          </div>
          <div style={{ fontSize: 10, color: COLORS.inkSubtle }}>
            {items.length} {items.length === 1 ? 'entrada' : 'entradas'}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 118 }} />{/* Fecha */}
              <col />{/* Concepto */}
              <col style={{ width: 90 }} />{/* TRM */}
              <col style={{ width: 100 }} />{/* USD */}
              <col style={{ width: 100 }} />{/* COP calc */}
              <col style={{ width: 42 }} />{/* Delete + save */}
            </colgroup>
            <thead>
              <tr>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Concepto</th>
                <th style={S.thNum}>TRM</th>
                <th style={S.thNum}>Valor USD</th>
                <th style={S.thNum}>= COP</th>
                <th style={{ ...S.th, textAlign: 'center' }} aria-label="acciones" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={S.emptyRow}>
                    Sin entradas — añade la primera abajo.
                  </td>
                </tr>
              )}
              {items.map((row) => {
                const cop = (row.exposicion_usd || 0) * (row.trm || 0);
                const usdNeg = (row.exposicion_usd || 0) < 0;
                const saveInd = SAVE_INDICATOR[row.saveState];
                return (
                  <tr key={row.id}>
                    <td style={S.td}>
                      <input
                        type="date"
                        value={row.fecha_vencimiento ?? ''}
                        onChange={(e) => patchRow(row.id, { fecha_vencimiento: e.target.value || null })}
                        onBlur={() => flushRow(row.id)}
                        disabled={!canEdit}
                        style={S.inputText}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="text"
                        value={row.concepto ?? ''}
                        onChange={(e) => patchRow(row.id, { concepto: e.target.value || null })}
                        onBlur={() => flushRow(row.id)}
                        disabled={!canEdit}
                        placeholder="ej. Utilización α-1"
                        style={S.inputText}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.trm ?? ''}
                        onChange={(e) => patchRow(row.id, {
                          trm: e.target.value === '' ? null : Number(e.target.value) || null,
                        })}
                        onBlur={() => flushRow(row.id)}
                        disabled={!canEdit}
                        placeholder="—"
                        style={{ ...S.input, textAlign: 'right' }}
                      />
                    </td>
                    <td style={S.td}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.exposicion_usd || ''}
                        onChange={(e) => patchRow(row.id, {
                          exposicion_usd: Number(e.target.value) || 0,
                        })}
                        onBlur={() => flushRow(row.id)}
                        disabled={!canEdit}
                        placeholder="0"
                        style={{
                          ...S.input,
                          textAlign: 'right',
                          color: usdNeg ? COLORS.neg : COLORS.ink,
                        }}
                      />
                    </td>
                    <td style={S.copCell}>
                      {row.trm != null && row.trm > 0
                        ? fmtCop(cop)
                        : <span style={{ color: COLORS.inkSubtle }}>—</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center', padding: '4px 2px' }}>
                      <span
                        style={{ ...S.saveIndicator, color: saveInd.color }}
                        title={saveInd.title}
                      >
                        {saveInd.text}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          title="Borrar entrada"
                          style={S.delBtn}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '6px 10px 10px' }}>
          <button
            type="button"
            onClick={() => addRow(q)}
            disabled={!canEdit}
            style={{
              ...S.addBtn,
              ...(isCurrent ? S.addBtnActual : {}),
              ...(!canEdit ? S.addBtnDisabled : {}),
            }}
          >
            + Nueva entrada {isCurrent ? 'a Q actual' : `a Q${q}`}
          </button>
        </div>

        <div style={S.subtotal}>
          <div style={S.subtotalLabel}>Subtotal</div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                ...S.subtotalValue,
                color: signColor(subUsd, COLORS.neg, COLORS.pos, COLORS.inkMuted),
              }}
            >
              {fmtUsd(subUsd)} USD
            </div>
            <div style={S.subtotalCop}>
              {subCop === 0 ? '—' : `${fmtCop(subCop)} COP`}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: COLORS.inkMuted, fontSize: 12 }}>
        Cargando exposición…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div
        style={{
          padding: '10px 14px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#991b1b',
          fontSize: 12,
        }}
      >
        Error cargando exposición: {fetchError}
      </div>
    );
  }

  return (
    <div>
      {/* Banner: total anual + Q actual */}
      <div style={S.banner}>
        <div>
          <div style={S.bannerLabel}>Exposición anual {year}</div>
          <div
            style={{
              ...S.bannerValue,
              color: signColor(totalUsd, COLORS.neg, COLORS.pos, COLORS.ink),
            }}
          >
            {fmtUsd(totalUsd)} <span style={{ fontSize: 14, color: COLORS.inkMuted }}>USD</span>
          </div>
          <div style={S.bannerSubValue}>
            ≡ {totalCop === 0 ? '—' : `${fmtCop(totalCop)} COP`}
            {anyMissingTrm && (
              <span style={{ color: '#b45309', fontSize: 11, marginLeft: 8 }}>
                (parcial: hay entradas sin TRM)
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...S.bannerLabel, color: COLORS.actual }}>
            Q actual (Q{currentQuarter}) · → Benchmark
          </div>
          <div
            style={{
              ...S.bannerValue,
              color: signColor(currentQuarterUsd, COLORS.neg, COLORS.pos, COLORS.ink),
            }}
          >
            {fmtUsd(currentQuarterUsd)} <span style={{ fontSize: 14, color: COLORS.inkMuted }}>USD</span>
          </div>
          <div style={S.bannerSubValue}>
            ≡ {currentQuarterCop === 0 ? '—' : `${fmtCop(currentQuarterCop)} COP`}
          </div>
        </div>
      </div>

      {/* Grid de 4 quarters */}
      <div style={S.grid}>
        {([1, 2, 3, 4] as const).map(renderQuarterCard)}
      </div>

      <div style={S.hint}>
        <strong>Cómo se usa:</strong> cada entrada representa una cuenta por pagar/cobrar
        USD con su propia TRM. El total COP del Q se calcula como <code>Σ (usd × trm)</code>.
        Si una entrada no tiene TRM, no suma al COP (queda como parcial). La moneda base
        de la empresa es COP — este dashboard consolida las líneas USD a esa moneda.
        <br />
        <strong>Signo:</strong> negativo = corto USD (CxP, importaciones). Positivo = largo
        USD (CxC, exportaciones). El monto del Q actual alimenta la fila USD del Benchmark.
        {fmtNum(0)}
      </div>
    </div>
  );
}
