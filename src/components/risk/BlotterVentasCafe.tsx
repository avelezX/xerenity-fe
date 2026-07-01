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
import { Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';

import {
  fetchCafeVentas,
  fetchCafeFactorConversion,
  fetchCafeCompraGlobals,
  CafeVentaRow,
} from 'src/lib/risk/supabaseRisk';
import { kgVerdeEquiv } from 'src/lib/risk/cafeVerdeFactor';
import VentasHistoricoCard from './VentasHistoricoCard';
import NuevaVentaModal from './NuevaVentaModal';

const LB_PER_KG = 2.20462;
// Cafe excelso colombiano: 1 saco = 70 kg estandar. KG se autocalcula
// desde sacos para evitar inconsistencia en el blotter.
const KG_PER_SACO = 70;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Row extends CafeVentaRow {
  saveState?: SaveState;
}

export interface VentasTotals {
  // ── Totales FILTRADOS (subset visible segun monthFilter, en kg verde equiv) ──
  kgTotal: number;        // kg verde equivalente (post factor por producto)
  totalCop: number;       // suma directa de los Total COP por fila
  precioKgCopPond: number; // ponderado por kg verde
  precioSacoCopPond: number;
  filas: number;
  // ── Totales ACUMULADOS (todo el dataset, ignora filtro) ──
  kgTotalCum: number;
  totalCopCum: number;
  precioKgCopPondCum: number;
  precioSacoCopPondCum: number;
  filasCum: number;
}

// Fila minima emitida al CafeMarginCard para correr FIFO matching.
// kgVerde = kg × kgVerdeFactor(producto). totalCop = venta directa.
// Solo se emiten filas tipo_venta='factura_cop' para evitar doble conteo.
export interface VentaMatchableRow {
  fecha: string;   // YYYY-MM-DD
  mes: number;     // 1..12 (mes de fecha_fijacion)
  kgVerde: number;
  totalCop: number;
}

interface Props {
  companyId: string;
  // Precio actual de CAFE KC (cents/lb) para calcular exposicion USD por fila.
  precioKcCents?: number | null;
  precioKcDate?: string | null;
  // Filtro multi-mes (array de 1..12). Vacio o undefined = sin filtro.
  monthFilter?: number[];
  // Callback opcional para que el padre (CafeMarginCard) reciba los
  // totales de ventas al cambio (auto-save flush incluido).
  onTotalsChange?: (t: VentasTotals) => void;
  // Callback opcional para emitir las filas matchables (raw) al CafeMarginCard.
  // Siempre emite TODAS las filas tipo_venta='factura_cop' — el FIFO necesita
  // el dataset completo para asignar costos en orden cronologico.
  onMatchableRowsChange?: (rows: VentaMatchableRow[]) => void;
}

export default function BlotterVentasCafe({ companyId, precioKcCents, precioKcDate, monthFilter, onTotalsChange, onMatchableRowsChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  // Modal de registro de nueva venta (tipo_venta='factura_cop')
  const [showNuevaVenta, setShowNuevaVenta] = useState(false);
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

  // Refactor: hago la carga extraible para poder refetch despues del modal.
  const reloadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
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
  }, [companyId]);

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
    // Branch por tipo_venta:
    //   - 'factura_cop' (default para datos nuevos): precio en COP/kg directo.
    //   - 'fijacion_ny' (legacy Sucafina-style): NY ¢/lb × factor × TRM.
    // Cualquier fila sin tipo_venta se asume 'fijacion_ny' por backwards
    // compat con las 12 filas seedeadas en jun-11.
    const tipo = r.tipo_venta ?? 'fijacion_ny';
    let kg = 0;
    let totalCop = 0;
    let totalUsd = 0;
    let precioCopKg = 0;
    let precioUsdKg = 0;
    let precioPorSacoCop = 0;
    let precioPorSacoUsd = 0;
    let precioFinal = 0;

    if (tipo === 'factura_cop') {
      // Factura domestica COP/kg directo. trm_dia capturado al seed.
      kg = r.kg || 0;
      precioCopKg = r.valor_kilo ?? 0;
      totalCop = kg * precioCopKg;
      const trm = r.trm_dia ?? 0;
      if (trm > 0) {
        totalUsd = totalCop / trm;
        precioUsdKg = precioCopKg / trm;
      }
      precioPorSacoCop = precioCopKg * KG_PER_SACO;
      precioPorSacoUsd = precioUsdKg * KG_PER_SACO;
    } else {
      // Fijacion NY (legacy). kg = sacos × 70.
      kg = (r.sacos ?? 0) * KG_PER_SACO;
      precioFinal = (r.fijacion_ny ?? 0) + (r.prima ?? 0);
      const trm = r.fijacion_cop ?? 0;
      precioPorSacoUsd = precioFinal * factor;
      precioPorSacoCop = precioPorSacoUsd * trm;
      precioCopKg = kg > 0 ? (precioPorSacoCop * r.sacos) / kg : 0;
      precioUsdKg = kg > 0 ? (precioPorSacoUsd * r.sacos) / kg : 0;
      totalCop = precioPorSacoCop * r.sacos;
      totalUsd = precioPorSacoUsd * r.sacos;
    }

    const contratosKc = lbsPorContrato > 0
      ? -(kg * LB_PER_KG) / lbsPorContrato
      : 0;
    const exposicionUsd = precioKc?.price != null
      ? contratosKc * lbsPorContrato * precioKc.price / 100
      : 0;
    return {
      row: r,
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

  // Totales para el CafeMarginCard.
  // Filtramos a SOLO tipo_venta='factura_cop' para evitar el doble conteo
  // de fijaciones NY Sucafina (el fixing NY + factura COP se refieren al
  // mismo despacho; contarlos ambos infla ~2×). Convertimos kg as-sold a
  // kg VERDE EQUIVALENTE.

  // Builder: dado un subset de computed, calcula los totales.
  const buildTotals = (subset: typeof computed) => {
    const realRows = subset.filter((c) => c.row.tipo_venta === 'factura_cop');
    const totalCop = realRows.reduce((s, c) => s + c.totalCop, 0);
    const totalUsd = realRows.reduce((s, c) => s + c.totalUsd, 0);
    const kgVerdeTotal = realRows.reduce(
      (s, c) => s + kgVerdeEquiv(c.row.producto, c.kg),
      0,
    );
    const precioKgCopPond = kgVerdeTotal > 0 ? totalCop / kgVerdeTotal : 0;
    return {
      sacos: realRows.reduce((s, c) => s + (c.row.sacos ?? 0), 0),
      kg: kgVerdeTotal,
      totalCop,
      totalUsd,
      precioKgCopPond,
      precioSacoCopPond: precioKgCopPond * KG_PER_SACO,
      contratosKc: realRows.reduce(
        (s, c) => s + (lbsPorContrato > 0
          ? -(kgVerdeEquiv(c.row.producto, c.kg) * LB_PER_KG) / lbsPorContrato
          : 0),
        0,
      ),
      exposicionUsd: realRows.reduce(
        (s, c) => {
          if (lbsPorContrato <= 0 || precioKc?.price == null) return s;
          const ctos = -(kgVerdeEquiv(c.row.producto, c.kg) * LB_PER_KG) / lbsPorContrato;
          return s + ctos * lbsPorContrato * precioKc.price / 100;
        },
        0,
      ),
      filas: realRows.length,
    };
  };

  // Subset filtrado por mes (usa fecha_fijacion). Multi-select.
  const computedFiltered = useMemo(() => {
    if (!monthFilter || monthFilter.length === 0) return computed;
    const monthSet = new Set(monthFilter);
    return computed.filter((c) => {
      const m = parseInt((c.row.fecha_fijacion || '').slice(5, 7), 10);
      return monthSet.has(m);
    });
  }, [computed, monthFilter]);

  const totals = useMemo(() => buildTotals(computedFiltered), [computedFiltered, lbsPorContrato, precioKc]);
  const totalsCum = useMemo(() => buildTotals(computed), [computed, lbsPorContrato, precioKc]);

  // Emitir totales al padre (CafeMarginCard) — incluye filtered + cumulative.
  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      kgTotal: totals.kg,
      totalCop: totals.totalCop,
      precioKgCopPond: totals.precioKgCopPond,
      precioSacoCopPond: totals.precioSacoCopPond,
      filas: totals.filas,
      kgTotalCum: totalsCum.kg,
      totalCopCum: totalsCum.totalCop,
      precioKgCopPondCum: totalsCum.precioKgCopPond,
      precioSacoCopPondCum: totalsCum.precioSacoCopPond,
      filasCum: totalsCum.filas,
    });
  }, [
    onTotalsChange,
    totals.kg,
    totals.totalCop,
    totals.precioKgCopPond,
    totals.precioSacoCopPond,
    totals.filas,
    totalsCum.kg,
    totalsCum.totalCop,
    totalsCum.precioKgCopPond,
    totalsCum.precioSacoCopPond,
    totalsCum.filas,
  ]);

  // Emitir filas matchables (raw) al CafeMarginCard para FIFO matching.
  // Solo emite tipo_venta='factura_cop' — evita el doble conteo con las
  // fijaciones NY Sucafina (mismo despacho registrado dos veces).
  useEffect(() => {
    if (!onMatchableRowsChange) return;
    const matchable: VentaMatchableRow[] = computed
      .filter((c) => c.row.tipo_venta === 'factura_cop')
      .map((c) => {
        const fecha = c.row.fecha_fijacion || '';
        return {
          fecha,
          mes: parseInt(fecha.slice(5, 7), 10) || 0,
          kgVerde: kgVerdeEquiv(c.row.producto, c.kg),
          totalCop: c.totalCop,
        };
      });
    onMatchableRowsChange(matchable);
  }, [onMatchableRowsChange, computed]);

  // NOTA: el detalle linea-a-linea fue removido en jun-2026. La gestion
  // de ventas se hace via Modal `NuevaVentaModal` (insert) y SQL/import
  // (bulk). Los handlers `commitRow/patchRow/handleAdd/handleDelete`
  // se eliminaron junto con la tabla detalle.

  return (
    <div className="mt-4 p-3" style={{ background: '#fefefe', border: '1px solid #e2e8f0', borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0" style={{ color: '#0f766e', fontWeight: 600 }}>
          ☕ Ventas de cafe · resumen por cliente
        </h6>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => setShowNuevaVenta(true)}
          disabled={!companyId || loading}
        >
          + Nueva venta
        </Button>
      </div>

      {companyId && (
        <NuevaVentaModal
          show={showNuevaVenta}
          onHide={() => setShowNuevaVenta(false)}
          companyId={companyId}
          existingRows={rows}
          onSaved={reloadAll}
        />
      )}

      {loading && (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" /> Cargando ventas...
        </div>
      )}

      {/* Vista unica: histórico agregado por cliente (facturas tipo='factura_cop').
          El detalle linea-a-linea se removio — gestion de ventas se hace via
          SQL/import (62 facturas seedeadas) y este card las muestra agregadas.
          Las fijaciones NY tipo='fijacion_ny' siguen en la tabla pero no se
          renderizan aqui (el card filtra por tipo='factura_cop' internamente). */}
      {!loading && rows.length > 0 && (
        <VentasHistoricoCard
          rows={(!monthFilter || monthFilter.length === 0)
            ? rows
            : (() => {
              const monthSet = new Set(monthFilter);
              return rows.filter((r) => monthSet.has(parseInt((r.fecha_fijacion || '').slice(5, 7), 10)));
            })()}
          precioKcCents={precioKc?.price ?? precioKcCents ?? null}
          lbsPorContrato={lbsPorContrato}
        />
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center text-muted py-4">
          No hay ventas registradas.
        </div>
      )}
    </div>
  );
}
