/* eslint-disable jsx-a11y/control-has-associated-label, no-underscore-dangle, no-nested-ternary, no-restricted-syntax, no-restricted-globals, react/self-closing-comp, @typescript-eslint/no-unused-vars, prefer-template */
/**
 * Blotter de compras de cafe. Tabla CRUD que se renderiza dentro del
 * tab Benchmark de /risk-management cuando la empresa tiene CAFE.
 *
 * Cada fila representa una compra: kg de cafe humedo + precio pagado por @.
 * El cafe humedo se convierte a cafe verde (vendible) via factor_humedo,
 * y solo el cafe verde se usa para el calculo de contratos y exposicion.
 *
 * Calculos derivados (en pantalla, no se almacenan):
 *   kg_verde               = total_kg × factor_humedo            (default 0.1434)
 *   total_at_compradas     = total_kg / kg_per_at                 (default 60)
 *   total_valor_compra     = total_at_compradas × valor_compra_at (COP)
 *   contratos_kc           = kg_verde × 2.2046 / lbs_por_contrato (default 37,500)
 *   exposicion_usd         = contratos_kc × lbs_por_contrato × precio_kc_cents / 100
 *
 * Inputs globales (en risk_company_config, editables al top del blotter):
 *   - kg_per_at             (default 60)      kg por @ de compra
 *   - lbs_por_contrato_kc   (default 37,500)  lbs por contrato Coffee C
 *   - factor_humedo         (default 0.1434)  conversion cafe humedo -> verde
 *
 * Precio KC actual: se trae del front contract en risk_prices (CAFE),
 * actualizado por collectors.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import useAppStore from 'src/store';

import {
  fetchCafeCompras,
  insertCafeCompra,
  updateCafeCompra,
  deleteCafeCompra,
  fetchCafeCompraGlobals,
  updateCafeCompraGlobals,
  CafeCompraRow,
} from 'src/lib/risk/supabaseRisk';

const LB_PER_KG = 2.20462;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Row extends CafeCompraRow {
  saveState?: SaveState;
}

const AUTOSAVE_MS = 600;

// Helpers visuales del badge de auto-save por fila.
const SAVE_STATE_GLYPH: Record<SaveState, string> = {
  idle: '',
  dirty: '●',
  saving: '⟳',
  saved: '✓',
  error: '!',
};

const SAVE_STATE_COLOR: Record<SaveState, string> = {
  idle: 'transparent',
  dirty: '#d97706',
  saving: '#0ea5e9',
  saved: '#15803d',
  error: '#b91c1c',
};

const SAVE_STATE_LABEL: Record<SaveState, string> = {
  idle: '',
  dirty: 'Pendiente — guardando en 0.6s',
  saving: 'Guardando...',
  saved: 'Guardado',
  error: 'Error al guardar',
};

// ── Table styles ─────────────────────────────────────────────
// Alineados con VentasHistoricoCard para look-and-feel consistente.

const TH: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#475569',
  fontWeight: 700,
  padding: '10px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  background: '#f8fafc',
  whiteSpace: 'nowrap',
};

const TH_NUM: React.CSSProperties = { ...TH, textAlign: 'right' };

const TD: React.CSSProperties = {
  fontSize: 12,
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

const TD_NUM: React.CSSProperties = {
  ...TD,
  textAlign: 'right',
  fontFamily: 'monospace',
};

const TD_INPUT: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};

const INPUT_NUM: React.CSSProperties = {
  fontSize: 12,
  padding: '4px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'monospace',
  width: '100%',
  textAlign: 'right',
  background: '#fff',
  color: '#0f172a',
  outline: 'none',
};

export interface ComprasTotals {
  // ── Totales FILTRADOS (subset visible segun monthFilter) ──
  kgVerdeTotal: number;
  totalCop: number;       // suma directa de Total Compra (COP) por fila
  precioKgCopPond: number; // ponderado por kg verde
  precioSacoCopPond: number;
  filas: number;
  // ── Totales ACUMULADOS (todo el dataset, ignora filtro) ──
  // Usado por el CafeMarginCard para calcular "costo de lo vendido"
  // con el precio promedio acumulado de compras, no el del mes.
  kgVerdeTotalCum: number;
  totalCopCum: number;
  precioKgCopPondCum: number;
  precioSacoCopPondCum: number;
  filasCum: number;
}

// Fila minima emitida al CafeMarginCard para correr FIFO matching.
// kgVerde = arrobas × 12.5 (calculado dentro del blotter).
// totalCop = arrobas × valor_compra_at (COP).
export interface CompraMatchableRow {
  fecha: string;     // YYYY-MM-DD
  kgVerde: number;
  totalCop: number;
}

interface Props {
  companyId: string;
  // Precio actual de CAFE (cents/lb) — viene de benchmarkFactors.factors.CAFE.price_end
  // del page padre, que es el mismo dato ya cargado para la tabla Benchmark.
  // Evita un fetch extra que puede estar bloqueado por RLS u otra cosa.
  precioKcCents?: number | null;
  precioKcDate?: string | null;
  // Filtro multi-mes (array de 1..12). Vacio o undefined = sin filtro.
  // Aplica a la vista de la tabla Y al subset usado para el margin card.
  monthFilter?: number[];
  // Callback opcional para que el CafeMarginCard reciba los totales.
  onTotalsChange?: (t: ComprasTotals) => void;
  // Callback opcional para emitir las filas matchables (raw) al CafeMarginCard
  // que las usa para FIFO matching. Siempre emite TODAS las filas, sin filtrar
  // por mes — el FIFO necesita el dataset completo para asignar costos en orden.
  onMatchableRowsChange?: (rows: CompraMatchableRow[]) => void;
}

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtKg = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtNum2 = (v: number): string => v.toFixed(2);

// Formato con signo explicito: +0.0718 (long) / -0.0718 (short).
// Cero se muestra como 0 sin signo (para no contaminar visualmente).
const fmtSignedNum4 = (v: number): string => {
  if (v === 0) return '0.0000';
  return `${v > 0 ? '+' : ''}${v.toFixed(4)}`;
};
const fmtSignedCop = (v: number): string => {
  if (v === 0) return '$0';
  const abs = new Intl.NumberFormat('es-CO').format(Math.round(Math.abs(v)));
  return `${v > 0 ? '+$' : '−$'}${abs}`;
};

function isoWeek(dateStr: string): number {
  // ISO week number from YYYY-MM-DD
  if (!dateStr) return 0;
  const d = new Date(`${dateStr}T12:00:00`);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Mon=0
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function emptyRow(companyId: string, loteId: string): Omit<Row, 'id' | 'created_at' | 'updated_at'> {
  return {
    company_id: companyId,
    lote_id: loteId,
    fecha_compra: new Date().toISOString().slice(0, 10),
    total_kg: 0,
    valor_compra_at: 0,
    factor_humedo: 0.1431,
  };
}

export default function BlotterCompraCafe({ companyId, precioKcCents, precioKcDate, monthFilter, onTotalsChange, onMatchableRowsChange }: Props) {
  const selectedLoteId = useAppStore((s) => s.selectedLoteId);
  const [rows, setRows] = useState<Row[]>([]);
  const [kgPerAt, setKgPerAt] = useState<number>(60);
  const [lbsPorContrato, setLbsPorContrato] = useState<number>(37500);
  const [loading, setLoading] = useState(false);
  const [savingGlobals, setSavingGlobals] = useState(false);

  // Timers de auto-save por fila. Cuando el usuario edita un input, debounce
  // 600ms y luego persiste. Si vuelve a editar antes, se reinicia el timer.
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Latest row snapshots para que el timer guarde el estado mas reciente sin
  // depender de closures sobre `rows`.
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => () => {
    // Cleanup: clear all pending timers on unmount
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
  }, []);

  // Precio actual KC — viene como prop del page padre (que ya lo carga via
  // benchmarkFactors). Si no esta, se muestra "no disponible".
  const precioKc = useMemo(
    () => (precioKcCents != null ? { price: precioKcCents, date: precioKcDate ?? '' } : null),
    [precioKcCents, precioKcDate],
  );

  // Initial load (compras filtradas por lote + globals).
  // Re-fetch automatico cuando cambia el lote seleccionado.
  // Si no hay lote, no fetcheamos — el usuario debe crear/seleccionar uno.
  useEffect(() => {
    if (!companyId) return;
    if (!selectedLoteId) {
      setRows([]);  // sin lote seleccionado: blotter vacio
      return;
    }
    setLoading(true);
    let comprasErr: string | null = null;
    let globalsErr: string | null = null;
    (async () => {
      try {
        const compras = await fetchCafeCompras(companyId, selectedLoteId);
        setRows(compras);
      } catch (e) {
        comprasErr = (e as Error)?.message || 'Error cargando compras';
      }
      try {
        const globals = await fetchCafeCompraGlobals(companyId);
        setKgPerAt(globals.kg_per_at);
        setLbsPorContrato(globals.lbs_per_contrato_kc);
      } catch (e) {
        globalsErr = (e as Error)?.message || 'Error cargando globals';
      }
      if (comprasErr) toast.error(comprasErr);
      if (globalsErr) toast.warning(`Globals: ${globalsErr} (usando defaults)`);
      setLoading(false);
    })();
  }, [companyId, selectedLoteId]);

  // Calc derived per row.
  // Convencion (jun 2026): kg verde compras = arrobas × 12.5 (arroba estandar).
  // Antes se usaba total_kg × factor_humedo (~0.143) lo que subestimaba en ~46%
  // y no calzaba con el kg verde del Blotter Ventas. Ahora ambos usan la
  // misma unidad de medida para que el FIFO matching del margen sea preciso.
  // factor_humedo se mantiene en la fila pero ya no se usa para kg verde.
  const computed = useMemo(() => rows.map((r) => {
    const totalAtCompradas = kgPerAt > 0 ? r.total_kg / kgPerAt : 0;
    const kgVerde = totalAtCompradas * 12.5;
    const totalValorCompra = totalAtCompradas * r.valor_compra_at;
    const precioKgVerdeCop = kgVerde > 0 ? totalValorCompra / kgVerde : 0;
    const precioSacoCop = precioKgVerdeCop * 70;
    // Hedging se calcula con cafe VERDE (no total kg humedo)
    const contratosKc = lbsPorContrato > 0 ? (kgVerde * LB_PER_KG) / lbsPorContrato : 0;
    const exposicionUsd = precioKc?.price != null
      ? contratosKc * lbsPorContrato * precioKc.price / 100
      : 0;
    return {
      row: r,
      semana: isoWeek(r.fecha_compra),
      kgVerde,
      totalAtCompradas,
      totalValorCompra,
      precioKgVerdeCop,
      precioSacoCop,
      contratosKc,
      exposicionUsd,
    };
  }), [rows, kgPerAt, lbsPorContrato, precioKc]);

  // Subset filtrado por mes (usa fecha_compra). Si monthFilter es vacio,
  // computedFiltered == computed.
  const computedFiltered = useMemo(() => {
    if (!monthFilter || monthFilter.length === 0) return computed;
    const monthSet = new Set(monthFilter);
    return computed.filter((c) => {
      const m = parseInt((c.row.fecha_compra || '').slice(5, 7), 10);
      return monthSet.has(m);
    });
  }, [computed, monthFilter]);

  // Helper para calcular totals desde un subset de computed
  const buildTotals = (subset: typeof computed) => {
    const totalKgVerde = subset.reduce((s, c) => s + c.kgVerde, 0);
    const totalValor = subset.reduce((s, c) => s + c.totalValorCompra, 0);
    const precioKgPond = totalKgVerde > 0 ? totalValor / totalKgVerde : 0;
    return {
      totalKg: subset.reduce((s, c) => s + (c.row.total_kg ?? 0), 0),
      kgVerde: totalKgVerde,
      totalAtCompradas: subset.reduce((s, c) => s + c.totalAtCompradas, 0),
      totalValorCompra: totalValor,
      precioKgVerdeCop: precioKgPond,
      precioSacoCop: precioKgPond * 70,
      contratosKc: subset.reduce((s, c) => s + c.contratosKc, 0),
      exposicionUsd: subset.reduce((s, c) => s + c.exposicionUsd, 0),
    };
  };

  // Totales del subset filtrado (para el KPI band visible y la tabla)
  const totals = useMemo(() => buildTotals(computedFiltered), [computedFiltered]);
  // Totales acumulados (todo el dataset, para el calculo del margen mes)
  const totalsCum = useMemo(() => buildTotals(computed), [computed]);

  // Emitir totales al padre (CafeMarginCard). Mismo patron que en
  // BlotterVentasCafe; el card calcula el margen restando ambos.
  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      kgVerdeTotal: totals.kgVerde,
      totalCop: totals.totalValorCompra,
      precioKgCopPond: totals.precioKgVerdeCop,
      precioSacoCopPond: totals.precioSacoCop,
      filas: computedFiltered.length,
      kgVerdeTotalCum: totalsCum.kgVerde,
      totalCopCum: totalsCum.totalValorCompra,
      precioKgCopPondCum: totalsCum.precioKgVerdeCop,
      precioSacoCopPondCum: totalsCum.precioSacoCop,
      filasCum: computed.length,
    });
  }, [
    onTotalsChange,
    totals.kgVerde,
    totals.totalValorCompra,
    totals.precioKgVerdeCop,
    totals.precioSacoCop,
    computedFiltered.length,
    totalsCum.kgVerde,
    totalsCum.totalValorCompra,
    totalsCum.precioKgVerdeCop,
    totalsCum.precioSacoCop,
    computed.length,
  ]);

  // Emitir filas matchables (raw) al CafeMarginCard para FIFO matching.
  // Siempre TODAS las filas — el FIFO necesita el dataset completo.
  useEffect(() => {
    if (!onMatchableRowsChange) return;
    onMatchableRowsChange(
      computed.map((c) => ({
        fecha: c.row.fecha_compra,
        kgVerde: c.kgVerde,
        totalCop: c.totalValorCompra,
      })),
    );
  }, [onMatchableRowsChange, computed]);

  const commitRow = useCallback(async (id: string) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r) return;
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'saving' } : x)));
    try {
      await updateCafeCompra(id, {
        fecha_compra: r.fecha_compra,
        total_kg: r.total_kg,
        valor_compra_at: r.valor_compra_at,
        factor_humedo: r.factor_humedo,
      });
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'saved' } : x)));
      // El badge "Guardado ✓" se oculta despues de 1.5s
      setTimeout(() => {
        setRows((prev) => prev.map((x) => (x.id === id && x.saveState === 'saved' ? { ...x, saveState: 'idle' } : x)));
      }, 1500);
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'error' } : x)));
      toast.error((e as Error)?.message || 'Error guardando fila');
    }
  }, []);

  // Auto-save con debounce. Cada cambio resetea el timer; al terminar de
  // editar (600ms sin tocar), persiste a Supabase. Asi no se pierde nada
  // aunque el usuario refresque sin hacer blur.
  const scheduleSave = useCallback((id: string) => {
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.current.delete(id);
      commitRow(id);
    }, AUTOSAVE_MS);
    saveTimers.current.set(id, timer);
  }, [commitRow]);

  const patchRow = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, saveState: 'dirty' } : r)));
    scheduleSave(id);
  }, [scheduleSave]);

  // Si hay save pendiente y el usuario hace blur, persiste inmediatamente
  // (no espera el debounce). Asi sigue siendo robusto en el caso clasico.
  const flushRow = useCallback((id: string) => {
    const existing = saveTimers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      saveTimers.current.delete(id);
      commitRow(id);
    }
  }, [commitRow]);

  const handleAdd = useCallback(async () => {
    if (!selectedLoteId) {
      toast.error('Selecciona o crea un lote antes de agregar una compra');
      return;
    }
    try {
      const newRow = await insertCafeCompra(emptyRow(companyId, selectedLoteId));
      setRows((prev) => [...prev, { ...newRow, saveState: 'idle' }]);
    } catch (e) {
      toast.error((e as Error)?.message || 'Error agregando fila');
    }
  }, [companyId, selectedLoteId]);

  const handleDelete = useCallback(async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('¿Borrar esta compra?')) return;
    try {
      await deleteCafeCompra(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error((e as Error)?.message || 'Error borrando fila');
    }
  }, []);

  const handleGlobalsBlur = useCallback(async () => {
    setSavingGlobals(true);
    try {
      await updateCafeCompraGlobals(companyId, {
        kg_per_at: kgPerAt,
        lbs_per_contrato_kc: lbsPorContrato,
      });
    } catch (e) {
      toast.error((e as Error)?.message || 'Error guardando parametros globales');
    } finally {
      setSavingGlobals(false);
    }
  }, [companyId, kgPerAt, lbsPorContrato]);

  return (
    <div className="mt-4 p-3" style={{ background: '#fefefe', border: '1px solid #e2e8f0', borderRadius: 6 }}>
      {/* Header: titulo + nueva compra */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0" style={{ color: '#7c3aed', fontWeight: 600 }}>
          ☕ Compras de café · resumen por semana
        </h6>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleAdd}
          disabled={!companyId || loading}
        >
          + Nueva compra
        </Button>
      </div>

      {/* KPI band — same pattern que VentasHistoricoCard pero paleta morada */}
      {!loading && rows.length > 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid #e9d5ff',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 14,
        }}
        >
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f8fafc 100%)',
            borderBottom: '1px solid #e9d5ff',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                Resumen de compras
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {rows.length} {rows.length === 1 ? 'compra' : 'compras'} registradas
              </div>
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 11, fontFamily: 'monospace' }}>
              <div>
                <span style={{ color: '#64748b' }}>Kg humedo:</span>{' '}
                <strong style={{ color: '#0f172a' }}>{fmtCop(totals.totalKg)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Kg verde:</span>{' '}
                <strong style={{ color: '#7c3aed' }}>{fmtCop(totals.kgVerde)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total compra:</span>{' '}
                <strong style={{ color: '#7c3aed' }}>${fmtNum2(totals.totalValorCompra)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Avg COP/kg verde:</span>{' '}
                <strong style={{ color: '#0f172a' }}>${fmtCop(totals.precioKgVerdeCop)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}># Ctos KC:</span>{' '}
                <strong style={{ color: totals.contratosKc > 0 ? '#15803d' : '#0f172a' }}>
                  {totals.contratosKc > 0 ? '+' : ''}{totals.contratosKc.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Exp USD:</span>{' '}
                <strong style={{ color: totals.exposicionUsd > 0 ? '#15803d' : '#0f172a' }}>
                  ${fmtCop(totals.exposicionUsd)}
                </strong>
              </div>
            </div>
          </div>

          {/* Subtle params strip — globals + Precio KC */}
          <div style={{
            padding: '8px 18px',
            background: '#fafafa',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontSize: 11,
            color: '#64748b',
          }}
          >
            <div className="d-flex align-items-center gap-2">
              <span>Kg / @:</span>
              <Form.Control
                type="number"
                step="0.1"
                size="sm"
                value={kgPerAt}
                onChange={(e) => setKgPerAt(Number(e.target.value) || 0)}
                onBlur={handleGlobalsBlur}
                style={{ width: 64, fontVariantNumeric: 'tabular-nums', fontSize: 11, height: 26 }}
                disabled={savingGlobals}
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <span>Lbs / Contrato KC:</span>
              <Form.Control
                type="number"
                step="100"
                size="sm"
                value={lbsPorContrato}
                onChange={(e) => setLbsPorContrato(Number(e.target.value) || 0)}
                onBlur={handleGlobalsBlur}
                style={{ width: 76, fontVariantNumeric: 'tabular-nums', fontSize: 11, height: 26 }}
                disabled={savingGlobals}
              />
            </div>
            <div style={{ marginLeft: 'auto' }}>
              {precioKc ? (
                <>
                  Precio KC actual:{' '}
                  <strong style={{ color: '#0f172a' }}>{fmtNum2(precioKc.price)}¢/lb</strong>{' '}
                  <span style={{ color: '#94a3b8' }}>({precioKc.date})</span>
                </>
              ) : (
                <span style={{ color: '#dc2626' }}>Precio KC no disponible</span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" /> Cargando blotter...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center text-muted py-4">
          No hay compras registradas. Haz clic en &ldquo;+ Nueva compra&rdquo; para comenzar.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} />{/* Fecha */}
              <col style={{ width: 50 }} />{/* Sem */}
              <col style={{ width: 105 }} />{/* Total Kg humedo */}
              <col style={{ width: 80 }} />{/* Factor */}
              <col style={{ width: 100 }} />{/* Kg verde (auto) */}
              <col style={{ width: 110 }} />{/* Valor @ */}
              <col style={{ width: 90 }} />{/* @ Compradas */}
              <col style={{ width: 110 }} />{/* Precio/Kg COP */}
              <col style={{ width: 125 }} />{/* Precio/Saco COP */}
              <col style={{ width: 145 }} />{/* Total Compra COP */}
              <col style={{ width: 95 }} />{/* # Ctos KC */}
              <col style={{ width: 130 }} />{/* Exp USD */}
              <col style={{ width: 44 }} />{/* X */}
            </colgroup>
            <thead>
              <tr>
                <th style={TH}>Fecha</th>
                <th style={TH_NUM}>Sem</th>
                <th style={TH_NUM}>Total Kg <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>húmedo</span></th>
                <th style={TH_NUM} title="Factor de conversion humedo a verde (editable per fila)">Factor</th>
                <th style={TH_NUM}>Kg verde</th>
                <th style={TH_NUM}>Valor @ <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>COP</span></th>
                <th style={TH_NUM}>@ compradas</th>
                <th style={TH_NUM}>Precio / kg <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>COP</span></th>
                <th style={TH_NUM}>Precio / saco <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>COP</span></th>
                <th style={TH_NUM}>Total compra <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>COP</span></th>
                <th style={TH_NUM} title="+ = LONG café (compraste, tienes inventario)"># Ctos KC</th>
                <th style={TH_NUM} title="+ = LONG USD (el inventario vale USD)">Exp USD</th>
                <th style={{ ...TH, textAlign: 'center', padding: '10px 4px' }} aria-label="Estado y acciones" />
              </tr>
            </thead>
            <tbody>
              {computedFiltered.map((c) => (
                <tr key={c.row.id}>
                  <td style={TD_INPUT}>
                    <input
                      type="date"
                      value={c.row.fecha_compra}
                      onChange={(e) => patchRow(c.row.id, { fecha_compra: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ ...INPUT_NUM, textAlign: 'left' }}
                    />
                  </td>
                  <td style={{ ...TD_NUM, color: '#94a3b8' }}>{c.semana || '—'}</td>
                  <td style={TD_INPUT}>
                    <input
                      type="number"
                      step="1"
                      value={c.row.total_kg}
                      onChange={(e) => patchRow(c.row.id, { total_kg: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={INPUT_NUM}
                    />
                  </td>
                  <td style={TD_INPUT}>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      value={c.row.factor_humedo ?? 0.1431}
                      onChange={(e) => patchRow(c.row.id, { factor_humedo: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={INPUT_NUM}
                      title="Factor de conversion humedo a verde (default 0.1431)"
                    />
                  </td>
                  <td style={{ ...TD_NUM, color: '#7c3aed', fontWeight: 600 }}>
                    {fmtKg(c.kgVerde)}
                  </td>
                  <td style={TD_INPUT}>
                    <input
                      type="number"
                      step="100"
                      value={c.row.valor_compra_at}
                      onChange={(e) => patchRow(c.row.id, { valor_compra_at: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={INPUT_NUM}
                    />
                  </td>
                  <td style={TD_NUM}>{fmtNum2(c.totalAtCompradas)}</td>
                  <td style={TD_NUM}>${fmtCop(c.precioKgVerdeCop)}</td>
                  <td style={TD_NUM}>${fmtCop(c.precioSacoCop)}</td>
                  <td style={{ ...TD_NUM, color: '#7c3aed', fontWeight: 600 }}>
                    ${fmtCop(c.totalValorCompra)}
                  </td>
                  <td style={{ ...TD_NUM, color: c.contratosKc >= 0 ? '#15803d' : '#b91c1c' }}>
                    {fmtSignedNum4(c.contratosKc)}
                  </td>
                  <td style={{ ...TD_NUM, color: c.exposicionUsd >= 0 ? '#15803d' : '#b91c1c' }}>
                    {fmtSignedCop(c.exposicionUsd)}
                  </td>
                  <td style={{ ...TD, textAlign: 'center', padding: '4px 4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        fontSize: 12,
                        marginRight: 4,
                        color: SAVE_STATE_COLOR[c.row.saveState ?? 'idle'],
                      }}
                      title={SAVE_STATE_LABEL[c.row.saveState ?? 'idle']}
                    >
                      {SAVE_STATE_GLYPH[c.row.saveState ?? 'idle']}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.row.id)}
                      title="Borrar"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                <td
                  style={{
                    ...TD,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#475569',
                    fontWeight: 700,
                    borderBottom: 'none',
                  }}
                  colSpan={2}
                >
                  Total <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>Pre/kg pond.</span>
                </td>
                <td style={{ ...TD_NUM, fontWeight: 600, borderBottom: 'none' }}>{fmtKg(totals.totalKg)}</td>
                <td style={{ ...TD_NUM, borderBottom: 'none' }} />
                <td style={{ ...TD_NUM, color: '#7c3aed', fontWeight: 700, borderBottom: 'none' }}>{fmtKg(totals.kgVerde)}</td>
                <td style={{ ...TD_NUM, borderBottom: 'none' }} />
                <td style={{ ...TD_NUM, fontWeight: 600, borderBottom: 'none' }}>{fmtNum2(totals.totalAtCompradas)}</td>
                <td style={{ ...TD_NUM, fontWeight: 600, borderBottom: 'none' }}>${fmtCop(totals.precioKgVerdeCop)}</td>
                <td style={{ ...TD_NUM, fontWeight: 600, borderBottom: 'none' }}>${fmtCop(totals.precioSacoCop)}</td>
                <td style={{ ...TD_NUM, color: '#7c3aed', fontWeight: 700, borderBottom: 'none' }}>${fmtCop(totals.totalValorCompra)}</td>
                <td
                  style={{
                    ...TD_NUM,
                    color: totals.contratosKc >= 0 ? '#15803d' : '#b91c1c',
                    fontWeight: 700,
                    borderBottom: 'none',
                  }}
                >
                  {fmtSignedNum4(totals.contratosKc)}
                </td>
                <td
                  style={{
                    ...TD_NUM,
                    color: totals.exposicionUsd >= 0 ? '#15803d' : '#b91c1c',
                    fontWeight: 700,
                    borderBottom: 'none',
                  }}
                >
                  {fmtSignedCop(totals.exposicionUsd)}
                </td>
                <td style={{ ...TD, borderBottom: 'none' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
