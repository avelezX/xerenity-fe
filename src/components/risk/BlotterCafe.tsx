/* eslint-disable jsx-a11y/control-has-associated-label, no-underscore-dangle, no-nested-ternary, no-restricted-syntax, no-restricted-globals, react/self-closing-comp */
/**
 * Blotter de fijaciones de cafe. Tabla CRUD que se renderiza dentro del
 * tab Benchmark de /risk-management cuando la empresa tiene CAFE en sus
 * commodities.
 *
 * Cada fila representa una operacion de fijacion: el momento en que se
 * congela el precio NY (cents/lb) + prima y el TRM para calcular el
 * precio efectivo en COP/saco / COP/kg / total.
 *
 * Formulas (cents/lb -> COP/saco):
 *   precio_final    = fijacion_ny + prima
 *   precio_por_saco = precio_final × factor × fijacion_cop
 *   precio_cop_kg   = precio_por_saco × sacos / kg
 *   total           = precio_por_saco × sacos
 *
 * Donde factor (default 1.5432) = (kg_por_saco × lb_por_kg) / 100.
 *
 * El total de la columna Total se reporta hacia arriba via onTotalChange
 * para alimentar la Exposicion Natural de la fila CAFE del Benchmark.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Form, Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';

import {
  fetchCafeFijaciones,
  insertCafeFijacion,
  updateCafeFijacion,
  deleteCafeFijacion,
  fetchCafeFactorConversion,
  updateCafeFactorConversion,
  fetchCafeCompraGlobals,
  CafeFijacionRow,
} from 'src/lib/risk/supabaseRisk';

const LB_PER_KG = 2.20462;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Row extends CafeFijacionRow {
  saveState?: SaveState;
}

const AUTOSAVE_MS = 600;

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

interface Props {
  companyId: string;
  // Precio actual de CAFE KC (cents/lb) para calcular exposicion USD por fila.
  // Llega del page padre (mismo dato que ya tiene la tabla Benchmark).
  precioKcCents?: number | null;
  precioKcDate?: string | null;
}

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

// USD lleva 0 o 2 decimales segun magnitud
const fmtUsd = (v: number): string =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtCents = (v: number): string => v.toFixed(2);
const fmtFactor = (v: number): string => v.toFixed(4);

// Formato signado: +0.0716 / -0.0716. Cero sin signo.
const fmtSignedNum4 = (v: number): string => {
  if (v === 0) return '0.0000';
  return `${v > 0 ? '+' : ''}${v.toFixed(4)}`;
};
const fmtSignedUsd = (v: number): string => {
  if (v === 0) return '$0';
  const abs = new Intl.NumberFormat('en-US').format(Math.round(Math.abs(v)));
  return `${v > 0 ? '+$' : '−$'}${abs}`;
};

function emptyRow(companyId: string): Omit<Row, 'id' | 'created_at' | 'updated_at'> {
  return {
    company_id: companyId,
    sacos_fijados: 0,
    kg: 0,
    fijacion_ny: 0,
    prima: 0,
    fijacion_cop: 0,
    fecha_fijacion: new Date().toISOString().slice(0, 10),
    moneda: 'COP',
  };
}

export default function BlotterCafe({ companyId, precioKcCents, precioKcDate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [factor, setFactor] = useState<number>(1.5432);
  const [lbsPorContrato, setLbsPorContrato] = useState<number>(37500);
  const [loading, setLoading] = useState(false);
  const [savingFactor, setSavingFactor] = useState(false);

  // Precio actual KC (cents/lb) para calcular Exp USD. Memo para evitar
  // re-renders cuando los props son los mismos.
  const precioKc = useMemo(
    () => (precioKcCents != null ? { price: precioKcCents, date: precioKcDate ?? '' } : null),
    [precioKcCents, precioKcDate],
  );

  // Auto-save por fila con debounce. rowsRef mantiene el snapshot mas
  // reciente para que el timer no quede pegado a un closure viejo.
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => () => {
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
  }, []);

  // Load on mount / company change. Cargamos fijaciones + factor + globals
  // (estos ultimos para tener lbs_por_contrato_kc del blotter compras y
  // compartirlo aqui en el calculo de # contratos).
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      try {
        const [fijaciones, fct, globals] = await Promise.all([
          fetchCafeFijaciones(companyId),
          fetchCafeFactorConversion(companyId),
          fetchCafeCompraGlobals(companyId).catch(() => null),
        ]);
        setRows(fijaciones);
        setFactor(fct);
        if (globals?.lbs_per_contrato_kc) setLbsPorContrato(globals.lbs_per_contrato_kc);
      } catch (e) {
        toast.error((e as Error)?.message || 'Error cargando blotter cafe');
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  // Calc derived per row (soporta COP y USD)
  //
  // Comun:
  //   precio_final         = NY + prima                    [cents/lb]
  //   precio_por_saco_USD  = precio_final × factor          (factor 1.5432 = lb/saco / 100)
  //   precio_por_saco_COP  = precio_por_saco_USD × TRM
  //
  // Segun moneda:
  //   COP -> precio_por_saco / total se muestran en COP
  //   USD -> precio_por_saco / total se muestran en USD
  //
  // Para footer (2 totales), cada fila aporta a AMBAS columnas:
  //   - Si row.moneda='COP': total_native = total_COP, total_other = total_COP/TRM
  //   - Si row.moneda='USD': total_native = total_USD, total_other = total_USD×TRM
  const computed = useMemo(() => rows.map((r) => {
    const precioFinal = (r.fijacion_ny ?? 0) + (r.prima ?? 0);
    const trm = r.fijacion_cop ?? 0;
    const precioPorSacoUsd = precioFinal * factor;
    const precioPorSacoCop = precioPorSacoUsd * trm;
    const precioCopKg = r.kg > 0 ? (precioPorSacoCop * r.sacos_fijados) / r.kg : 0;
    const precioUsdKg = r.kg > 0 ? (precioPorSacoUsd * r.sacos_fijados) / r.kg : 0;
    const totalCop = precioPorSacoCop * r.sacos_fijados;
    const totalUsd = precioPorSacoUsd * r.sacos_fijados;
    // # Ctos KC y Exp USD: la fijacion es una VENTA forward, asi que es
    // SHORT cafe (signo negativo). El kg representa cafe verde vendido.
    //   contratos = -(kg × lb/kg) / lbs_por_contrato
    //   exp_usd   = contratos × lbs_por_contrato × precio_KC_cents / 100
    const contratosKc = lbsPorContrato > 0
      ? -(r.kg * LB_PER_KG) / lbsPorContrato
      : 0;
    const exposicionUsd = precioKc?.price != null
      ? contratosKc * lbsPorContrato * precioKc.price / 100
      : 0;
    return {
      row: r,
      precioFinal,
      precioPorSacoCop,
      precioPorSacoUsd,
      precioCopKg,
      precioUsdKg,
      totalCop,
      totalUsd,
      contratosKc,
      exposicionUsd,
    };
  }), [rows, factor, lbsPorContrato, precioKc]);

  // Totals: 2 sumatorias (COP nativos + USD convertidos a COP via TRM por fila, viceversa)
  const totals = useMemo(() => {
    const { totalCop, totalUsd } = computed.reduce(
      (acc, c) => {
        if (c.row.moneda === 'USD') {
          // fila en USD: total nativo USD, COP equivalente via TRM de la fila
          acc.totalUsd += c.totalUsd;
          acc.totalCop += c.totalUsd * (c.row.fijacion_cop ?? 0);
        } else {
          // fila en COP: total nativo COP, USD equivalente via TRM de la fila
          acc.totalCop += c.totalCop;
          if (c.row.fijacion_cop && c.row.fijacion_cop > 0) {
            acc.totalUsd += c.totalCop / c.row.fijacion_cop;
          }
        }
        return acc;
      },
      { totalCop: 0, totalUsd: 0 },
    );
    return {
      sacos: computed.reduce((s, c) => s + (c.row.sacos_fijados ?? 0), 0),
      kg: computed.reduce((s, c) => s + (c.row.kg ?? 0), 0),
      totalCop,
      totalUsd,
      contratosKc: computed.reduce((s, c) => s + c.contratosKc, 0),
      exposicionUsd: computed.reduce((s, c) => s + c.exposicionUsd, 0),
    };
  }, [computed]);

  // Commit row to Supabase (forzado, sin filtrar por _dirty: el debounce
  // ya garantiza que solo se llama cuando hubo cambios).
  const commitRow = useCallback(async (id: string) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r) return;
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'saving' } : x)));
    try {
      await updateCafeFijacion(id, {
        sacos_fijados: r.sacos_fijados,
        kg: r.kg,
        fijacion_ny: r.fijacion_ny,
        prima: r.prima,
        fijacion_cop: r.fijacion_cop,
        fecha_fijacion: r.fecha_fijacion,
        moneda: r.moneda,
      });
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'saved' } : x)));
      setTimeout(() => {
        setRows((prev) => prev.map((x) => (x.id === id && x.saveState === 'saved' ? { ...x, saveState: 'idle' } : x)));
      }, 1500);
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'error' } : x)));
      toast.error((e as Error)?.message || 'Error guardando fila');
    }
  }, []);

  // Auto-save con debounce: cualquier cambio reinicia el timer; al pasar
  // 600ms sin tocar, persiste. Esto cubre el caso "el usuario refresca
  // sin hacer blur" donde antes se perdian los cambios.
  const scheduleSave = useCallback((id: string) => {
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      saveTimers.current.delete(id);
      commitRow(id);
    }, AUTOSAVE_MS);
    saveTimers.current.set(id, timer);
  }, [commitRow]);

  // Patch row state locally + agenda auto-save
  const patchRow = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, saveState: 'dirty' } : r)));
    scheduleSave(id);
  }, [scheduleSave]);

  // Flush pendiente (cuando el usuario hace blur, no esperamos el debounce)
  const flushRow = useCallback((id: string) => {
    const existing = saveTimers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      saveTimers.current.delete(id);
      commitRow(id);
    }
  }, [commitRow]);

  // Add new row
  const handleAdd = useCallback(async () => {
    try {
      const newRow = await insertCafeFijacion(emptyRow(companyId));
      setRows((prev) => [...prev, { ...newRow, saveState: 'idle' }]);
    } catch (e) {
      toast.error((e as Error)?.message || 'Error agregando fila');
    }
  }, [companyId]);

  // Delete row
  const handleDelete = useCallback(async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('¿Borrar esta fijacion?')) return;
    try {
      await deleteCafeFijacion(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error((e as Error)?.message || 'Error borrando fila');
    }
  }, []);

  // Save factor on blur
  const handleFactorBlur = useCallback(async () => {
    setSavingFactor(true);
    try {
      await updateCafeFactorConversion(companyId, factor);
      toast.success(`Factor de conversion guardado: ${fmtFactor(factor)}`);
    } catch (e) {
      toast.error((e as Error)?.message || 'Error guardando factor');
    } finally {
      setSavingFactor(false);
    }
  }, [companyId, factor]);

  return (
    <div className="mt-4 p-3" style={{ background: '#fefefe', border: '1px solid #e2e8f0', borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0" style={{ color: '#7c3aed', fontWeight: 600 }}>
          ☕ Blotter Fijaciones Cafe
        </h6>
        <div className="d-flex align-items-center gap-2">
          <Form.Label className="mb-0 small text-muted">Factor de conversion:</Form.Label>
          <Form.Control
            type="number"
            step="0.0001"
            size="sm"
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value) || 0)}
            onBlur={handleFactorBlur}
            style={{ width: 100 }}
            disabled={savingFactor}
          />
          <span className="text-muted small" style={{ minWidth: 80 }}>
            {savingFactor ? <Spinner size="sm" /> : '(lb/saco / 100)'}
          </span>
          <Button variant="outline-primary" size="sm" onClick={handleAdd}>
            + Nueva fijacion
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
          No hay fijaciones registradas. Haz clic en &ldquo;+ Nueva fijacion&rdquo; para comenzar.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-responsive">
          <Table
            size="sm"
            striped
            hover
            className="align-middle small mb-0"
            style={{
              tableLayout: 'fixed',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <colgroup>
              <col style={{ width: 120 }} />{/* Fecha */}
              <col style={{ width: 70 }} />{/* Moneda */}
              <col style={{ width: 70 }} />{/* Sacos */}
              <col style={{ width: 85 }} />{/* KG */}
              <col style={{ width: 90 }} />{/* Fij NY */}
              <col style={{ width: 80 }} />{/* Prima */}
              <col style={{ width: 100 }} />{/* Precio Final */}
              <col style={{ width: 95 }} />{/* TRM */}
              <col style={{ width: 120 }} />{/* Precio/KG */}
              <col style={{ width: 120 }} />{/* Precio/Saco */}
              <col style={{ width: 135 }} />{/* Total */}
              <col style={{ width: 95 }} />{/* # Ctos KC */}
              <col style={{ width: 130 }} />{/* Exp USD */}
              <col style={{ width: 70 }} />{/* Estado + X */}
            </colgroup>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                <th style={{ padding: '8px 10px' }}>Fecha</th>
                <th className="text-center" style={{ padding: '8px 6px' }}>Moneda</th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Sacos</th>
                <th className="text-end" style={{ padding: '8px 10px' }}>KG</th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Fij. NY <span style={{ textTransform: 'none', fontWeight: 400 }}>(¢/lb)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Prima <span style={{ textTransform: 'none', fontWeight: 400 }}>(¢/lb)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>P. Final <span style={{ textTransform: 'none', fontWeight: 400 }}>(¢/lb)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>TRM</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / KG</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / Saco</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Total</th>
                <th
                  className="text-end"
                  style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }}
                  title="− = SHORT café (vendido forward, ya no tienes inventario)"
                >
                  # Ctos KC <span style={{ textTransform: 'none', fontWeight: 400 }}>(café)</span>
                </th>
                <th
                  className="text-end"
                  style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }}
                  title="− = SHORT USD (la venta ya esta locked)"
                >
                  Exp. USD
                </th>
                <th style={{ padding: '8px 4px' }} aria-label="Estado y acciones" />
              </tr>
            </thead>
            <tbody>
              {computed.map((c) => {
                const isUsd = c.row.moneda === 'USD';
                const ppKg = isUsd ? c.precioUsdKg : c.precioCopKg;
                const ppSaco = isUsd ? c.precioPorSacoUsd : c.precioPorSacoCop;
                const total = isUsd ? c.totalUsd : c.totalCop;
                const monedaPrefix = isUsd ? '$' : '$';      // ambos usan $; el badge dice cual
                return (
                <tr key={c.row.id}>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="date"
                      size="sm"
                      value={c.row.fecha_fijacion}
                      onChange={(e) => patchRow(c.row.id, { fecha_fijacion: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      className="w-100"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Select
                      size="sm"
                      value={c.row.moneda}
                      onChange={(e) => {
                        // patchRow agenda auto-save con debounce (600ms);
                        // como el select no dispara blur, dejamos al timer.
                        patchRow(c.row.id, { moneda: e.target.value as 'COP' | 'USD' });
                      }}
                      className="w-100"
                      style={{
                        fontWeight: 600,
                        color: isUsd ? '#1d4ed8' : '#15803d',
                        background: isUsd ? '#dbeafe' : '#dcfce7',
                      }}
                    >
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                    </Form.Select>
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.sacos_fijados}
                      onChange={(e) => patchRow(c.row.id, { sacos_fijados: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="0.01"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.kg}
                      onChange={(e) => patchRow(c.row.id, { kg: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="0.01"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.fijacion_ny}
                      onChange={(e) => patchRow(c.row.id, { fijacion_ny: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="0.01"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.prima}
                      onChange={(e) => patchRow(c.row.id, { prima: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCents(c.precioFinal)}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="number"
                      step="0.01"
                      size="sm"
                      className="text-end w-100"
                      value={c.row.fijacion_cop}
                      onChange={(e) => patchRow(c.row.id, { fijacion_cop: Number(e.target.value) || 0 })}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {monedaPrefix}{isUsd ? fmtUsd(ppKg) : fmtCop(ppKg)}
                  </td>
                  <td className="text-end" style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {monedaPrefix}{isUsd ? fmtUsd(ppSaco) : fmtCop(ppSaco)}
                  </td>
                  <td className="text-end fw-bold" style={{ background: '#f1f5f9', color: isUsd ? '#1d4ed8' : '#15803d', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {monedaPrefix}{isUsd ? fmtUsd(total) : fmtCop(total)}
                  </td>
                  <td className="text-end fw-semibold" style={{ background: '#fef3c7', color: c.contratosKc >= 0 ? '#15803d' : '#b91c1c', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtSignedNum4(c.contratosKc)}
                  </td>
                  <td className="text-end fw-semibold" style={{ background: '#fef3c7', color: c.exposicionUsd >= 0 ? '#15803d' : '#b91c1c', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtSignedUsd(c.exposicionUsd)}
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
                );
              })}
            </tbody>
            <tfoot>
              {/* 14 columnas: Fecha, Moneda, Sacos, KG, FijNY, Prima, PFinal,
                  TRM, PrecioKG, PrecioSaco, Total, #CtosKC, ExpUSD, Estado.
                  2 filas de totales (COP / USD). #Ctos KC y Exp. USD viven
                  en ambas filas porque son magnitudes de hedging globales. */}
              <tr style={{ background: '#f1f5f9', fontWeight: 600, borderTop: '2px solid #cbd5e1' }}>
                <td style={{ padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', color: '#475569' }}>Total <span style={{ color: '#15803d' }}>COP</span></td>
                <td />
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtCop(totals.sacos)}</td>
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtCop(totals.kg)}</td>
                <td colSpan={6} />
                <td className="text-end" style={{ color: '#15803d', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>${fmtCop(totals.totalCop)}</td>
                <td className="text-end" style={{ color: totals.contratosKc >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>{fmtSignedNum4(totals.contratosKc)}</td>
                <td className="text-end" style={{ color: totals.exposicionUsd >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>{fmtSignedUsd(totals.exposicionUsd)}</td>
                <td />
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 600, borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', color: '#475569' }}>Total <span style={{ color: '#1d4ed8' }}>USD</span></td>
                <td colSpan={9} />
                <td className="text-end" style={{ color: '#1d4ed8', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>${fmtUsd(totals.totalUsd)}</td>
                <td colSpan={2} />
                <td />
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
