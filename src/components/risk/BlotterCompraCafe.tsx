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
import { Table, Form, Button, Spinner } from 'react-bootstrap';
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

export interface ComprasTotals {
  kgVerdeTotal: number;
  totalCop: number;       // suma directa de Total Compra (COP) por fila
  precioKgCopPond: number; // ponderado por kg verde
  precioSacoCopPond: number;
  filas: number;
}

interface Props {
  companyId: string;
  // Precio actual de CAFE (cents/lb) — viene de benchmarkFactors.factors.CAFE.price_end
  // del page padre, que es el mismo dato ya cargado para la tabla Benchmark.
  // Evita un fetch extra que puede estar bloqueado por RLS u otra cosa.
  precioKcCents?: number | null;
  precioKcDate?: string | null;
  // Callback opcional para que el CafeMarginCard reciba los totales.
  onTotalsChange?: (t: ComprasTotals) => void;
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

export default function BlotterCompraCafe({ companyId, precioKcCents, precioKcDate, onTotalsChange }: Props) {
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

  // Calc derived per row — factor_humedo ahora es per-fila.
  // Precio/Kg verde y Precio/Saco son los normalizadores que permiten
  // comparar contra el Blotter Ventas (que ya los expone).
  const computed = useMemo(() => rows.map((r) => {
    const factor = r.factor_humedo ?? 0.1431;
    const kgVerde = r.total_kg * factor;
    const totalAtCompradas = kgPerAt > 0 ? r.total_kg / kgPerAt : 0;
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

  // Totals — Precio/Kg y Precio/Saco se ponderan por kg verde (no
  // simple sum) porque son medias, no acumuladores.
  const totals = useMemo(() => {
    const totalKgVerde = computed.reduce((s, c) => s + c.kgVerde, 0);
    const totalValor = computed.reduce((s, c) => s + c.totalValorCompra, 0);
    const precioKgPond = totalKgVerde > 0 ? totalValor / totalKgVerde : 0;
    return {
      totalKg: rows.reduce((s, r) => s + (r.total_kg ?? 0), 0),
      kgVerde: totalKgVerde,
      totalAtCompradas: computed.reduce((s, c) => s + c.totalAtCompradas, 0),
      totalValorCompra: totalValor,
      precioKgVerdeCop: precioKgPond,
      precioSacoCop: precioKgPond * 70,
      contratosKc: computed.reduce((s, c) => s + c.contratosKc, 0),
      exposicionUsd: computed.reduce((s, c) => s + c.exposicionUsd, 0),
    };
  }, [rows, computed]);

  // Emitir totales al padre (CafeMarginCard). Mismo patron que en
  // BlotterVentasCafe; el card calcula el margen restando ambos.
  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      kgVerdeTotal: totals.kgVerde,
      totalCop: totals.totalValorCompra,
      precioKgCopPond: totals.precioKgVerdeCop,
      precioSacoCopPond: totals.precioSacoCop,
      filas: computed.length,
    });
  }, [
    onTotalsChange,
    totals.kgVerde,
    totals.totalValorCompra,
    totals.precioKgVerdeCop,
    totals.precioSacoCop,
    computed.length,
  ]);

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
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
        <h6 className="mb-0" style={{ color: '#7c3aed', fontWeight: 600 }}>
          ☕ Blotter Compras Café
        </h6>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0 small text-muted">Kg / @:</Form.Label>
            <Form.Control
              type="number"
              step="0.1"
              size="sm"
              value={kgPerAt}
              onChange={(e) => setKgPerAt(Number(e.target.value) || 0)}
              onBlur={handleGlobalsBlur}
              style={{ width: 70, fontVariantNumeric: 'tabular-nums' }}
              disabled={savingGlobals}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0 small text-muted">Lbs / KC:</Form.Label>
            <Form.Control
              type="number"
              step="100"
              size="sm"
              value={lbsPorContrato}
              onChange={(e) => setLbsPorContrato(Number(e.target.value) || 0)}
              onBlur={handleGlobalsBlur}
              style={{ width: 85, fontVariantNumeric: 'tabular-nums' }}
              disabled={savingGlobals}
            />
          </div>
          <div className="text-muted small" style={{ minWidth: 150 }}>
            {precioKc ? (
              <>
                Precio KC: <strong style={{ color: '#1e293b' }}>{fmtNum2(precioKc.price)}¢/lb</strong>{' '}
                <span className="text-muted">({precioKc.date})</span>
              </>
            ) : (
              <span className="text-warning">Precio KC no disponible</span>
            )}
          </div>
          <Button variant="outline-primary" size="sm" onClick={handleAdd}>
            + Nueva compra
          </Button>
        </div>
      </div>

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
        <div className="table-responsive">
          <Table
            size="sm"
            striped
            hover
            className="align-middle small mb-0"
            style={{ tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}
          >
            <colgroup>
              {/* Bloque IDENTIFICACION */}
              <col style={{ width: 120 }} />{/* Fecha */}
              <col style={{ width: 50 }} />{/* Sem */}
              {/* Bloque VOLUMEN + PRECIO INPUT */}
              <col style={{ width: 110 }} />{/* Total Kg humedo */}
              <col style={{ width: 85 }} />{/* Factor */}
              <col style={{ width: 105 }} />{/* Kg verde */}
              <col style={{ width: 115 }} />{/* Valor @ */}
              <col style={{ width: 90 }} />{/* @ Compradas */}
              {/* Bloque NORMALIZADO + TOTAL + HEDGING (compartido con Ventas) */}
              <col style={{ width: 110 }} />{/* Precio/Kg COP */}
              <col style={{ width: 125 }} />{/* Precio/Saco COP */}
              <col style={{ width: 145 }} />{/* Total Compra COP */}
              <col style={{ width: 95 }} />{/* # Ctos KC */}
              <col style={{ width: 135 }} />{/* Exp USD */}
              <col style={{ width: 50 }} />{/* X */}
            </colgroup>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                <th style={{ padding: '8px 8px' }}>Fecha</th>
                <th className="text-end" style={{ padding: '8px 6px' }}>Sem</th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Total Kg <span style={{ textTransform: 'none', fontWeight: 400 }}>(húmedo)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }} title="Factor de conversion humedo a verde (editable per fila)">Factor <span style={{ textTransform: 'none', fontWeight: 400 }}>conv.</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Kg verde <span style={{ textTransform: 'none', fontWeight: 400 }}>(auto)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Valor @ <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>@ Compradas</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / Kg <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / Saco <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#dcfce7', color: '#15803d' }}>Total Compra <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }} title="+ = LONG café (compraste, tienes inventario)">
                  # Ctos KC <span style={{ textTransform: 'none', fontWeight: 400 }}>(café)</span>
                </th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }} title="+ = LONG USD (el inventario vale USD)">
                  Exp. USD
                </th>
                <th style={{ padding: '8px 4px' }} aria-label="Estado y acciones" />
              </tr>
            </thead>
            <tbody>
              {computed.map((c) => (
                <tr key={c.row.id}>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={c.row.fecha_compra}
                      onChange={(e) => patchRow(c.row.id, { fecha_compra: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      className="w-100"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td className="text-end text-muted" style={{ padding: '4px 6px' }}>{c.semana || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="1"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.total_kg}
                      onChange={(e) => patchRow(c.row.id, { total_kg: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.factor_humedo ?? 0.1431}
                      onChange={(e) => patchRow(c.row.id, { factor_humedo: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                      title="Factor de conversion humedo a verde (default 0.1431)"
                    />
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px' }}>
                    {fmtKg(c.kgVerde)}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="100"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.valor_compra_at}
                      onChange={(e) => patchRow(c.row.id, { valor_compra_at: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px' }}>
                    {fmtNum2(c.totalAtCompradas)}
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtCop(c.precioKgVerdeCop)}
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    ${fmtCop(c.precioSacoCop)}
                  </td>
                  <td className="text-end fw-bold" style={{ background: '#dcfce7', color: '#15803d', padding: '4px 12px' }}>
                    ${fmtCop(c.totalValorCompra)}
                  </td>
                  <td className="text-end fw-semibold" style={{ background: '#fef3c7', color: c.contratosKc >= 0 ? '#15803d' : '#b91c1c', padding: '4px 12px' }}>
                    {fmtSignedNum4(c.contratosKc)}
                  </td>
                  <td className="text-end fw-semibold" style={{ background: '#fef3c7', color: c.exposicionUsd >= 0 ? '#15803d' : '#b91c1c', padding: '4px 12px' }}>
                    {fmtSignedCop(c.exposicionUsd)}
                  </td>
                  <td style={{ padding: '4px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        fontSize: '0.85rem',
                        marginRight: 4,
                        color: SAVE_STATE_COLOR[c.row.saveState ?? 'idle'],
                      }}
                      title={SAVE_STATE_LABEL[c.row.saveState ?? 'idle']}
                    >
                      {SAVE_STATE_GLYPH[c.row.saveState ?? 'idle']}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleDelete(c.row.id)}
                      title="Borrar"
                      className="p-0 text-danger"
                      style={{ lineHeight: 1, fontSize: '1.1rem' }}
                    >
                      &times;
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* 13 cols: Fecha, Sem, Total Kg, Factor, Kg verde, Valor @,
                  @ Compradas, Precio/Kg, Precio/Saco, Total Compra, # Ctos KC,
                  Exp USD, X. Precio/Kg y Precio/Saco son PONDERADOS (no simple
                  sum) — son medias por kg verde. */}
              <tr style={{ background: '#f1f5f9', fontWeight: 600, borderTop: '2px solid #cbd5e1' }}>
                <td style={{ padding: '8px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem', color: '#475569' }} colSpan={2}>Total <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>(Pre/Kg pond.)</span></td>
                <td className="text-end" style={{ padding: '8px 10px' }}>{fmtKg(totals.totalKg)}</td>
                <td />{/* Factor (no aplica suma) */}
                <td className="text-end" style={{ padding: '8px 12px' }}>{fmtKg(totals.kgVerde)}</td>
                <td />
                <td className="text-end" style={{ padding: '8px 12px' }}>{fmtNum2(totals.totalAtCompradas)}</td>
                <td className="text-end" style={{ padding: '8px 12px' }}>${fmtCop(totals.precioKgVerdeCop)}</td>
                <td className="text-end" style={{ padding: '8px 12px' }}>${fmtCop(totals.precioSacoCop)}</td>
                <td className="text-end" style={{ color: '#15803d', padding: '8px 12px', fontSize: '0.95rem' }}>${fmtCop(totals.totalValorCompra)}</td>
                <td className="text-end" style={{ color: totals.contratosKc >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontSize: '0.95rem' }}>{fmtSignedNum4(totals.contratosKc)}</td>
                <td className="text-end" style={{ color: totals.exposicionUsd >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontSize: '0.95rem' }}>{fmtSignedCop(totals.exposicionUsd)}</td>
                <td />
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
