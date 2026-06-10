/* eslint-disable jsx-a11y/control-has-associated-label, no-underscore-dangle, no-nested-ternary, no-restricted-syntax, no-restricted-globals, react/self-closing-comp */
/**
 * Blotter de ventas de cafe. Tabla CRUD que se renderiza dentro del
 * tab Benchmark de /risk-management cuando la empresa tiene CAFE en sus
 * commodities (e.g. El Embrujo vendiendo a Sucafina).
 *
 * El blotter registra fijaciones de VENTA a un cliente externo. No esta
 * atado a un lote de compra. Persiste en xerenity.cafe_ventas.
 *
 * Columnas de input:
 *   ref_contrato (e.g. MPEX-18066), ny_mes (U6, Z6, ...), calidad
 *   (Mr Hat (Excelso)), fecha_fijacion, sacos, fijacion_ny (¢/lb),
 *   prima (¢/lb), fijacion_cop (TRM), moneda (COP/USD), estado.
 *
 * Formulas por fila:
 *   kg              = sacos × 70  (cafe excelso colombiano, autocalculado)
 *   precio_final    = fijacion_ny + prima
 *   precio_por_saco = precio_final × factor × fijacion_cop
 *   precio_cop_kg   = precio_por_saco × sacos / kg
 *   total           = precio_por_saco × sacos
 *
 * Footer: simple sums (no promedios ponderados).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Form, Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';

import {
  fetchCafeVentas,
  insertCafeVenta,
  updateCafeVenta,
  deleteCafeVenta,
  fetchCafeFactorConversion,
  fetchCafeCompraGlobals,
  CafeVentaRow,
} from 'src/lib/risk/supabaseRisk';

const LB_PER_KG = 2.20462;
// Cafe excelso colombiano: 1 saco = 70 kg estandar. KG se autocalcula
// desde sacos para evitar inconsistencia en el blotter.
const KG_PER_SACO = 70;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Row extends CafeVentaRow {
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

export interface VentasTotals {
  kgTotal: number;        // sacos × 70 sumado
  totalCop: number;       // suma directa de los Total COP por fila
  precioKgCopPond: number; // ponderado por kg
  precioSacoCopPond: number;
  filas: number;
}

interface Props {
  companyId: string;
  // Precio actual de CAFE KC (cents/lb) para calcular exposicion USD por fila.
  precioKcCents?: number | null;
  precioKcDate?: string | null;
  // Callback opcional para que el padre (CafeMarginCard) reciba los
  // totales de ventas al cambio (auto-save flush incluido).
  onTotalsChange?: (t: VentasTotals) => void;
}

// ISO week number — mismo helper que BlotterCompraCafe, para que ambas
// tablas reporten "Sem" en la misma convencion.
function isoWeek(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(`${dateStr}T12:00:00`);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtUsd = (v: number): string =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtCents = (v: number): string => v.toFixed(2);

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
    ref_contrato: '',
    ny_mes: '',
    calidad: '',
    sacos: 0,
    kg: 0,
    fijacion_ny: 0,
    prima: 0,
    fijacion_cop: 0,
    fecha_fijacion: new Date().toISOString().slice(0, 10),
    moneda: 'COP',
    estado: '',
  };
}

export default function BlotterVentasCafe({ companyId, precioKcCents, precioKcDate, onTotalsChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [factor, setFactor] = useState<number>(1.5432);
  const [lbsPorContrato, setLbsPorContrato] = useState<number>(37500);
  const [loading, setLoading] = useState(false);

  const precioKc = useMemo(
    () => (precioKcCents != null ? { price: precioKcCents, date: precioKcDate ?? '' } : null),
    [precioKcCents, precioKcDate],
  );

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => () => {
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    (async () => {
      try {
        const [ventas, fct, globals] = await Promise.all([
          fetchCafeVentas(companyId),
          fetchCafeFactorConversion(companyId),
          fetchCafeCompraGlobals(companyId).catch(() => null),
        ]);
        setRows(ventas);
        setFactor(fct);
        if (globals?.lbs_per_contrato_kc) setLbsPorContrato(globals.lbs_per_contrato_kc);
      } catch (e) {
        toast.error((e as Error)?.message || 'Error cargando blotter ventas cafe');
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  // Calc derived per row — mismo motor que BlotterVentasCafe.
  // Diferencia conceptual: aqui la venta es LARGA en COP/USD recibidos
  // y SHORT en cafe (entrega fisica), igual que en fijaciones de compra
  // forward. Mantenemos el signo negativo de # Ctos KC.
  const computed = useMemo(() => rows.map((r) => {
    // kg = sacos × 70 (excelso). Recomputamos en cada render por si la
    // fila vino de la DB con un kg legacy que ya no cuadra.
    const kg = (r.sacos ?? 0) * KG_PER_SACO;
    const precioFinal = (r.fijacion_ny ?? 0) + (r.prima ?? 0);
    const trm = r.fijacion_cop ?? 0;
    const precioPorSacoUsd = precioFinal * factor;
    const precioPorSacoCop = precioPorSacoUsd * trm;
    const precioCopKg = kg > 0 ? (precioPorSacoCop * r.sacos) / kg : 0;
    const precioUsdKg = kg > 0 ? (precioPorSacoUsd * r.sacos) / kg : 0;
    const totalCop = precioPorSacoCop * r.sacos;
    const totalUsd = precioPorSacoUsd * r.sacos;
    const contratosKc = lbsPorContrato > 0
      ? -(kg * LB_PER_KG) / lbsPorContrato
      : 0;
    const exposicionUsd = precioKc?.price != null
      ? contratosKc * lbsPorContrato * precioKc.price / 100
      : 0;
    return {
      row: r,
      semana: isoWeek(r.fecha_fijacion),
      kg,
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

  // Totales: SIMPLE SUMS (no promedios ponderados). Sacos/KG son sumas
  // directas; total COP y USD acumulan native + conversion via TRM por
  // fila — mismo patron que BlotterVentasCafe.
  const totals = useMemo(() => {
    const { totalCop, totalUsd } = computed.reduce(
      (acc, c) => {
        if (c.row.moneda === 'USD') {
          acc.totalUsd += c.totalUsd;
          acc.totalCop += c.totalUsd * (c.row.fijacion_cop ?? 0);
        } else {
          acc.totalCop += c.totalCop;
          if (c.row.fijacion_cop && c.row.fijacion_cop > 0) {
            acc.totalUsd += c.totalCop / c.row.fijacion_cop;
          }
        }
        return acc;
      },
      { totalCop: 0, totalUsd: 0 },
    );
    const kgTotal = computed.reduce((s, c) => s + c.kg, 0);
    // Precio/Kg ponderado por kg (mismo patron que BlotterCompraCafe).
    // Lo usa el CafeMarginCard para comparar contra compras.
    const precioKgCopPond = kgTotal > 0 ? totalCop / kgTotal : 0;
    return {
      sacos: computed.reduce((s, c) => s + (c.row.sacos ?? 0), 0),
      kg: kgTotal,
      totalCop,
      totalUsd,
      precioKgCopPond,
      precioSacoCopPond: precioKgCopPond * KG_PER_SACO,
      contratosKc: computed.reduce((s, c) => s + c.contratosKc, 0),
      exposicionUsd: computed.reduce((s, c) => s + c.exposicionUsd, 0),
    };
  }, [computed]);

  // Emitir totales al padre (CafeMarginCard). Evitamos un useEffect-on-prop
  // por la condicion de loop: en su lugar disparamos solo cuando cambian
  // los numbers que importan.
  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      kgTotal: totals.kg,
      totalCop: totals.totalCop,
      precioKgCopPond: totals.precioKgCopPond,
      precioSacoCopPond: totals.precioSacoCopPond,
      filas: computed.length,
    });
  }, [
    onTotalsChange,
    totals.kg,
    totals.totalCop,
    totals.precioKgCopPond,
    totals.precioSacoCopPond,
    computed.length,
  ]);

  const commitRow = useCallback(async (id: string) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r) return;
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, saveState: 'saving' } : x)));
    try {
      await updateCafeVenta(id, {
        ref_contrato: r.ref_contrato,
        ny_mes: r.ny_mes,
        calidad: r.calidad,
        sacos: r.sacos,
        kg: r.kg,
        fijacion_ny: r.fijacion_ny,
        prima: r.prima,
        fijacion_cop: r.fijacion_cop,
        fecha_fijacion: r.fecha_fijacion,
        moneda: r.moneda,
        estado: r.estado,
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

  const flushRow = useCallback((id: string) => {
    const existing = saveTimers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      saveTimers.current.delete(id);
      commitRow(id);
    }
  }, [commitRow]);

  const handleAdd = useCallback(async () => {
    try {
      const newRow = await insertCafeVenta(emptyRow(companyId));
      setRows((prev) => [...prev, { ...newRow, saveState: 'idle' }]);
    } catch (e) {
      toast.error((e as Error)?.message || 'Error agregando fila');
    }
  }, [companyId]);

  const handleDelete = useCallback(async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('¿Borrar esta venta?')) return;
    try {
      await deleteCafeVenta(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error((e as Error)?.message || 'Error borrando fila');
    }
  }, []);

  return (
    <div className="mt-4 p-3" style={{ background: '#fefefe', border: '1px solid #e2e8f0', borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0" style={{ color: '#0f766e', fontWeight: 600 }}>
          ☕ Blotter Ventas Cafe
        </h6>
        <Button variant="outline-primary" size="sm" onClick={handleAdd}>
          + Nueva venta
        </Button>
      </div>

      {loading && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" /> Cargando blotter ventas...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center text-muted py-4">
          No hay ventas registradas. Haz clic en &ldquo;+ Nueva venta&rdquo; para comenzar.
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
              {/* Bloque IDENTIFICACION (compartido con Blotter Compras): Fecha, Sem, Estado */}
              <col style={{ width: 120 }} />{/* Fecha */}
              <col style={{ width: 50 }} />{/* Sem */}
              <col style={{ width: 110 }} />{/* Estado */}
              {/* Bloque METADATA VENTA (solo aplica aqui) */}
              <col style={{ width: 130 }} />{/* Ref Contrato */}
              <col style={{ width: 70 }} />{/* NY Mes */}
              <col style={{ width: 140 }} />{/* Calidad */}
              {/* Bloque VOLUMEN + PRECIO INPUT */}
              <col style={{ width: 70 }} />{/* Moneda */}
              <col style={{ width: 70 }} />{/* Sacos */}
              <col style={{ width: 85 }} />{/* KG */}
              <col style={{ width: 90 }} />{/* Fij NY */}
              <col style={{ width: 80 }} />{/* Prima */}
              <col style={{ width: 100 }} />{/* ¢/lb NY */}
              <col style={{ width: 95 }} />{/* TRM */}
              {/* Bloque NORMALIZADO + TOTAL + HEDGING (compartido con Compras) */}
              <col style={{ width: 120 }} />{/* Precio/KG */}
              <col style={{ width: 120 }} />{/* Precio/Saco */}
              <col style={{ width: 135 }} />{/* Total */}
              <col style={{ width: 95 }} />{/* # Ctos KC */}
              <col style={{ width: 130 }} />{/* Exp USD */}
              <col style={{ width: 50 }} />{/* X */}
            </colgroup>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569' }}>
                <th style={{ padding: '8px 10px' }}>Fecha</th>
                <th className="text-end" style={{ padding: '8px 6px' }}>Sem</th>
                <th style={{ padding: '8px 10px' }}>Estado</th>
                <th style={{ padding: '8px 10px' }}>Ref Contrato</th>
                <th className="text-center" style={{ padding: '8px 6px' }}>NY Mes</th>
                <th style={{ padding: '8px 10px' }}>Calidad</th>
                <th className="text-center" style={{ padding: '8px 6px' }}>Moneda</th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Sacos</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>KG <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>(auto)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Fij. NY <span style={{ textTransform: 'none', fontWeight: 400 }}>(¢/lb)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>Prima <span style={{ textTransform: 'none', fontWeight: 400 }}>(¢/lb)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>¢/lb NY <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>(final)</span></th>
                <th className="text-end" style={{ padding: '8px 10px' }}>TRM</th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / Kg <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#f1f5f9' }}>Precio / Saco <span style={{ textTransform: 'none', fontWeight: 400 }}>(COP)</span></th>
                <th className="text-end" style={{ padding: '8px 10px', background: '#dcfce7', color: '#15803d' }}>Total</th>
                <th
                  className="text-end"
                  style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }}
                  title="− = SHORT cafe (vendido forward)"
                >
                  # Ctos KC <span style={{ textTransform: 'none', fontWeight: 400 }}>(cafe)</span>
                </th>
                <th
                  className="text-end"
                  style={{ padding: '8px 10px', background: '#fef3c7', color: '#854d0e' }}
                  title="− = SHORT USD (venta locked)"
                >
                  Exp. USD
                </th>
                <th style={{ padding: '8px 4px' }} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {computed.map((c) => {
                const isUsd = c.row.moneda === 'USD';
                const ppKg = isUsd ? c.precioUsdKg : c.precioCopKg;
                const ppSaco = isUsd ? c.precioPorSacoUsd : c.precioPorSacoCop;
                const total = isUsd ? c.totalUsd : c.totalCop;
                const monedaPrefix = isUsd ? '$' : '$';
                return (
                <tr key={c.row.id}>
                  {/* Bloque IDENTIFICACION: Fecha · Sem · Estado (idem Blotter Compras) */}
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
                  <td className="text-end text-muted" style={{ padding: '4px 6px' }}>{c.semana || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={c.row.estado}
                      onChange={(e) => patchRow(c.row.id, { estado: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      placeholder="Fijada"
                      className="w-100"
                    />
                  </td>
                  {/* Bloque METADATA VENTA: Ref Contrato · NY Mes · Calidad */}
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={c.row.ref_contrato}
                      onChange={(e) => patchRow(c.row.id, { ref_contrato: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      placeholder="MPEX-..."
                      className="w-100"
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={c.row.ny_mes}
                      onChange={(e) => patchRow(c.row.id, { ny_mes: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      placeholder="U6"
                      className="w-100 text-center"
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Control
                      type="text"
                      size="sm"
                      value={c.row.calidad}
                      onChange={(e) => patchRow(c.row.id, { calidad: e.target.value })}
                      onBlur={() => flushRow(c.row.id)}
                      placeholder="Mr Hat (Excelso)"
                      className="w-100"
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Form.Select
                      size="sm"
                      value={c.row.moneda}
                      onChange={(e) => {
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
                      value={c.row.sacos}
                      onChange={(e) => {
                        const sacos = Number(e.target.value) || 0;
                        patchRow(c.row.id, { sacos, kg: sacos * KG_PER_SACO });
                      }}
                      onBlur={() => flushRow(c.row.id)}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                  </td>
                  <td
                    className="text-end"
                    style={{ background: '#f1f5f9', padding: '4px 12px', fontVariantNumeric: 'tabular-nums' }}
                    title={`KG = Sacos × ${KG_PER_SACO} kg/saco (excelso)`}
                  >
                    {fmtCop(c.kg)}
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
              {/* 19 columnas: Fecha, Sem, Estado, RefCtto, NYMes, Calidad, Moneda,
                  Sacos, KG, FijNY, Prima, ¢/lbNY, TRM, Pre/Kg, Pre/Saco, Total,
                  #CtosKC, ExpUSD, X.
                  Pre/Kg y Pre/Saco son PONDERADOS por kg (mismo patron que
                  BlotterCompraCafe); el resto son sumas directas. */}
              <tr style={{ background: '#f1f5f9', fontWeight: 600, borderTop: '2px solid #cbd5e1' }}>
                <td colSpan={7} style={{ padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', color: '#475569' }}>Total <span style={{ color: '#15803d' }}>COP</span> <span style={{ textTransform: 'none', fontWeight: 400, color: '#94a3b8' }}>(Pre/Kg pond.)</span></td>
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtCop(totals.sacos)}</td>
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{fmtCop(totals.kg)}</td>
                <td colSpan={4} />
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>${fmtCop(totals.precioKgCopPond)}</td>
                <td className="text-end" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>${fmtCop(totals.precioSacoCopPond)}</td>
                <td className="text-end" style={{ color: '#15803d', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>${fmtCop(totals.totalCop)}</td>
                <td className="text-end" style={{ color: totals.contratosKc >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>{fmtSignedNum4(totals.contratosKc)}</td>
                <td className="text-end" style={{ color: totals.exposicionUsd >= 0 ? '#15803d' : '#b91c1c', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>{fmtSignedUsd(totals.exposicionUsd)}</td>
                <td />
              </tr>
              <tr style={{ background: '#f8fafc', fontWeight: 600, borderTop: '1px solid #e2e8f0' }}>
                <td colSpan={7} style={{ padding: '8px 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem', color: '#475569' }}>Total <span style={{ color: '#1d4ed8' }}>USD</span></td>
                <td colSpan={8} />
                <td className="text-end" style={{ color: '#1d4ed8', padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>${fmtUsd(totals.totalUsd)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
