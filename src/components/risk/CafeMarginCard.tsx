/**
 * Card de Margen Compras vs Ventas para Café.
 *
 * Metodologia (jun 2026): FIFO (First In First Out) sobre kg verde.
 * Reemplaza el modelo anterior de "precio promedio acumulado" que era
 * una aproximacion. Ahora asignamos costo a cada kg vendido con la
 * regla contable clasica: el primer kg vendido consume del primer kg
 * comprado.
 *
 * Algoritmo:
 *   - Ambos blotters emiten filas raw {fecha, kgVerde, totalCop}.
 *   - kg verde compras = arrobas × 12.5  (ver BlotterCompraCafe).
 *   - kg verde ventas  = kg × factor_producto  (ver kgVerdeFactor).
 *   - Ordena compras + ventas asc por fecha.
 *   - Por cada venta, consume kg de la cola de compras (mas viejo primero).
 *     Costo asignado a esa venta = Σ (kg consumido × precio_kg de esa compra).
 *   - Si la cola se vacia antes de cubrir la venta, el kg residual queda
 *     como "sin cobertura" (probablemente inventario inicial no cargado).
 *
 * Salidas:
 *   - Cost of Goods Sold total (Ventas de todo el periodo)
 *   - COGS del subset (Ventas de los meses seleccionados)
 *   - kg cubierto vs kg sin cobertura
 *   - Margen $ y % basados en COGS real (no promedios).
 */
import { useEffect, useMemo, useState } from 'react';
import type { ComprasTotals, CompraMatchableRow } from 'src/components/risk/BlotterCompraCafe';
import type { VentasTotals, VentaMatchableRow } from 'src/components/risk/BlotterVentasCafe';

interface Props {
  companyId: string;
  compras: ComprasTotals | null;
  ventas: VentasTotals | null;
  comprasRows: CompraMatchableRow[];
  ventasRows: VentaMatchableRow[];
  /** Meses seleccionados (1..12). Array vacio o undefined = sin filtro
   *  (solo se muestra el total acumulado). Si hay 1+ meses, tambien se
   *  muestra la seccion filtrada. */
  monthFilter?: number[];
}

// Costo del inventario inicial (arranque del ciclo). Persistido en
// localStorage por empresa. Es una adicion FLAT al COGS acumulado que
// captura el valor del cafe (cereza + verde) que ya estaba en bodega al
// inicio del ciclo. Se distribuye a los subsets filtrados por mes de
// forma proporcional a los kg vendidos del periodo — el usuario no tiene
// que informar kg de inventario, solo el valor COP total.
//
// Nota: NO va al queue del FIFO (no sabemos los kg exactos, seria una
// suposicion). Se agrega despues del FIFO como un rubro contable extra
// del COGS. Los kg sin cobertura del FIFO siguen apareciendo como
// informativos pero ya no inflan el margen (porque el COP inicial cubre
// su costo).
const OPENING_COP_LS_KEY = (companyId: string) => `cafe_opening_cop:${companyId}`;

function loadOpeningCop(companyId: string): number {
  if (typeof window === 'undefined' || !companyId) return 0;
  try {
    const raw = localStorage.getItem(OPENING_COP_LS_KEY(companyId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveOpeningCop(companyId: string, cop: number): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.setItem(OPENING_COP_LS_KEY(companyId), String(cop));
  } catch {
    // ignore quota errors
  }
}

const MES_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtKg = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtCopCompact = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const fmtSignedCop = (v: number): string => {
  if (v === 0) return '$0';
  const abs = new Intl.NumberFormat('es-CO').format(Math.round(Math.abs(v)));
  return `${v > 0 ? '+$' : '−$'}${abs}`;
};

const fmtPctVal = (v: number): string => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};

const pnlColor = (v: number): string => {
  if (v > 0) return '#15803d';
  if (v < 0) return '#b91c1c';
  return '#475569';
};

// ── FIFO matcher ────────────────────────────────────────────────────────

interface FifoVentaResult {
  fecha: string;
  mes: number;
  kgVerde: number;
  totalCop: number;
  cogs: number;       // costo asignado por FIFO
  kgCubierto: number; // kg que si tienen cobertura de compras
  kgSinCobertura: number; // kg residual (inventario inicial no cargado)
}

interface FifoOutput {
  perVenta: FifoVentaResult[];
  // Agregados globales
  totalKgVendido: number;
  totalCogs: number;
  totalRevenue: number;
  totalKgCubierto: number;
  totalKgSinCobertura: number;
  // Compras remanentes (sin vender)
  kgCompraRemanente: number;
  totalKgComprado: number;
}

function runFifo(
  comprasRows: CompraMatchableRow[],
  ventasRows: VentaMatchableRow[],
): FifoOutput {
  const totalKgComprado = comprasRows.reduce((s, c) => s + c.kgVerde, 0);

  // Ordenar compras asc por fecha, calcular precio por kg (para asignacion).
  const cQ = comprasRows
    .filter((c) => c.kgVerde > 0)
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((c) => ({
      fecha: c.fecha,
      kgRemaining: c.kgVerde,
      precioPorKg: c.totalCop / c.kgVerde,
    }));

  // Ordenar ventas asc por fecha (para consumo cronologico).
  // Incluir filas con kgVerde=0 (pasilla) — no consumen compras (cogs=0)
  // pero su totalCop SI cuenta como revenue (byproduct income). Excluirlas
  // subestimaria las ventas totales del margen y no calzaria con el histo-
  // rico por cliente.
  const vQ = ventasRows
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  let cIdx = 0;
  const perVenta: FifoVentaResult[] = vQ.map((v) => {
    let kgRest = v.kgVerde;
    let cogs = 0;
    let kgCubierto = 0;

    while (kgRest > 1e-9 && cIdx < cQ.length) {
      const c = cQ[cIdx];
      if (c.kgRemaining <= 1e-9) {
        cIdx += 1;
        continue;
      }
      const consume = Math.min(kgRest, c.kgRemaining);
      cogs += consume * c.precioPorKg;
      c.kgRemaining -= consume;
      kgRest -= consume;
      kgCubierto += consume;
      if (c.kgRemaining <= 1e-9) cIdx += 1;
    }

    return {
      fecha: v.fecha,
      mes: v.mes,
      kgVerde: v.kgVerde,
      totalCop: v.totalCop,
      cogs,
      kgCubierto,
      kgSinCobertura: kgRest,
    };
  });

  const kgCompraRemanente = cQ.reduce((s, c) => s + Math.max(0, c.kgRemaining), 0);

  return {
    perVenta,
    totalKgVendido: perVenta.reduce((s, r) => s + r.kgVerde, 0),
    totalCogs: perVenta.reduce((s, r) => s + r.cogs, 0),
    totalRevenue: perVenta.reduce((s, r) => s + r.totalCop, 0),
    totalKgCubierto: perVenta.reduce((s, r) => s + r.kgCubierto, 0),
    totalKgSinCobertura: perVenta.reduce((s, r) => s + r.kgSinCobertura, 0),
    kgCompraRemanente,
    totalKgComprado,
  };
}

// ── Styles ──────────────────────────────────────────────────────────────

const SECTION: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #fde68a',
  borderRadius: 8,
  padding: '12px 16px',
};

const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#854d0e',
  fontWeight: 700,
  marginBottom: 8,
};

// ── Component ───────────────────────────────────────────────────────────

export default function CafeMarginCard({
  companyId,
  compras,
  ventas,
  comprasRows,
  ventasRows,
  monthFilter,
}: Props) {
  const hasCum = (compras?.filasCum ?? 0) > 0 && (ventas?.filasCum ?? 0) > 0;
  const monthsSelected = monthFilter ?? [];

  const monthsLabel = monthsSelected.length === 0
    ? null
    : monthsSelected.length === 1
      ? MES_NAMES[monthsSelected[0] - 1]
      : monthsSelected.length <= 3
        ? monthsSelected.map((m) => MES_NAMES[m - 1]).join(', ')
        : `${monthsSelected.length} meses`;

  // Costo inventario inicial (COP total) — carga desde localStorage por empresa.
  // NO va al queue del FIFO (no sabemos kg exactos); se suma flat al COGS
  // acumulado y proporcional (por kg vendido) al COGS del subset.
  const [openingCop, setOpeningCop] = useState<number>(0);
  const [openingLoaded, setOpeningLoaded] = useState<boolean>(false);

  useEffect(() => {
    setOpeningCop(loadOpeningCop(companyId));
    setOpeningLoaded(true);
  }, [companyId]);

  useEffect(() => {
    if (!openingLoaded) return undefined;
    const timer = setTimeout(() => {
      saveOpeningCop(companyId, openingCop);
    }, 400);
    return () => clearTimeout(timer);
  }, [companyId, openingCop, openingLoaded]);

  const fifo = useMemo(
    () => runFifo(comprasRows, ventasRows),
    [comprasRows, ventasRows],
  );

  // Agregados del subset (meses seleccionados). El FIFO se corre completo
  // arriba (necesita orden cronologico total); aca solo filtramos las
  // ventas resultado para presentar el margen del periodo.
  const monthSet = useMemo(() => new Set(monthsSelected), [monthsSelected]);
  const hasMonth = monthsSelected.length > 0 && ventasRows.length > 0 && comprasRows.length > 0;

  const subsetRevenue = useMemo(() => {
    if (!hasMonth) return 0;
    return fifo.perVenta.filter((v) => monthSet.has(v.mes)).reduce((s, v) => s + v.totalCop, 0);
  }, [fifo, monthSet, hasMonth]);

  const subsetCogs = useMemo(() => {
    if (!hasMonth) return 0;
    return fifo.perVenta.filter((v) => monthSet.has(v.mes)).reduce((s, v) => s + v.cogs, 0);
  }, [fifo, monthSet, hasMonth]);

  const subsetKgVendido = useMemo(() => {
    if (!hasMonth) return 0;
    return fifo.perVenta.filter((v) => monthSet.has(v.mes)).reduce((s, v) => s + v.kgVerde, 0);
  }, [fifo, monthSet, hasMonth]);

  const subsetKgCubierto = useMemo(() => {
    if (!hasMonth) return 0;
    return fifo.perVenta.filter((v) => monthSet.has(v.mes)).reduce((s, v) => s + v.kgCubierto, 0);
  }, [fifo, monthSet, hasMonth]);

  const subsetKgSinCobertura = useMemo(() => {
    if (!hasMonth) return 0;
    return fifo.perVenta.filter((v) => monthSet.has(v.mes)).reduce((s, v) => s + v.kgSinCobertura, 0);
  }, [fifo, monthSet, hasMonth]);

  // Costo del inventario inicial repartido:
  //   - Acumulado: se suma flat al COGS total del año.
  //   - Subset filtrado: se asigna en proporcion a los kg vendidos del subset
  //     vs los kg vendidos totales. Si un mes vendio 30% de los kg, absorbe
  //     el 30% del costo inicial.
  const openingShare = fifo.totalKgVendido > 0 && hasMonth
    ? openingCop * (subsetKgVendido / fifo.totalKgVendido)
    : 0;

  const subsetCogsTotal = subsetCogs + openingShare;
  const subsetMargen = subsetRevenue - subsetCogsTotal;
  const subsetMargenPct = subsetRevenue > 0 ? (subsetMargen / subsetRevenue) * 100 : 0;

  const cumCogsTotal = fifo.totalCogs + openingCop;
  const cumMargen = fifo.totalRevenue - cumCogsTotal;
  const cumMargenPct = fifo.totalRevenue > 0 ? (cumMargen / fifo.totalRevenue) * 100 : 0;

  const totalCompraCumCop = compras?.totalCopCum ?? 0;

  if (!hasCum) {
    return (
      <div className="mt-4 p-3" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6 }}>
        <h6 className="mb-0" style={{ color: '#854d0e', fontWeight: 600 }}>
          🎯 Margen Compras ↔ Ventas Café (FIFO)
        </h6>
        <div className="small text-muted mt-2">
          Necesita compras + ventas registradas para calcular el margen.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3" style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h6 className="mb-0" style={{ color: '#854d0e', fontWeight: 600 }}>
          🎯 Margen Compras ↔ Ventas Café · <span style={{ fontSize: 11, color: '#92400e', fontWeight: 500 }}>metodologia FIFO</span>
        </h6>
        <div className="small" style={{ color: '#92400e' }}>
          {monthsLabel
            ? <>Vista: <strong>{monthsLabel}</strong> · acumulado</>
            : <>Vista: <strong>Acumulado</strong> (todo el periodo)</>}
        </div>
      </div>

      {/* Inputs de inventario inicial. El FIFO los consume primero. */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #fde68a',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          fontSize: 12,
        }}
      >
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#854d0e', fontWeight: 700 }}>
          Costo inventario inicial (ciclo anterior)
        </div>
        <div className="d-flex align-items-center gap-2">
          <span style={{ color: '#64748b' }}>Total COP:</span>
          <input
            type="number"
            step="1"
            min="0"
            value={openingCop || ''}
            onChange={(e) => setOpeningCop(Number(e.target.value) || 0)}
            style={{
              width: 160,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12,
              padding: '3px 6px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              textAlign: 'right',
            }}
            placeholder="0"
          />
        </div>
        <div style={{ color: '#64748b', fontSize: 11, flex: '1 1 auto' }}>
          Se suma flat al COGS acumulado · se distribuye a los subsets proporcional a los kg vendidos del periodo (sin asumir kg específicos)
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          Autosave localStorage
        </div>
      </div>

      <div className="row g-3">
        {/* MARGEN DEL SUBSET FILTRADO (si hay meses seleccionados) */}
        {hasMonth && (
          <div className="col-md-6">
            <div style={SECTION}>
              <div style={LABEL_STYLE}>
                Margen de {monthsLabel}{' '}
                <span style={{ color: '#92400e', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                  ({monthsSelected.length === 1 ? 'mes seleccionado' : 'meses seleccionados'})
                </span>
              </div>
              <table style={TABLE_STYLE}>
                <tbody>
                  <tr>
                    <td style={{ color: '#64748b', paddingBottom: 4 }}>Ventas del periodo</td>
                    <td className="text-end" style={{ color: '#1e293b', fontWeight: 600, paddingBottom: 4 }}>
                      ${fmtCop(subsetRevenue)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{ color: '#64748b', paddingBottom: 4 }}
                      title="Costo FIFO de las ventas del periodo (asignado por orden cronologico)"
                    >
                      − Costo FIFO
                    </td>
                    <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                      ${fmtCop(subsetCogs)}
                    </td>
                  </tr>
                  {openingShare > 0 && (
                    <tr>
                      <td
                        style={{ color: '#64748b', paddingBottom: 4 }}
                        title="Costo del inventario inicial, prorrateado por kg vendidos del periodo"
                      >
                        − Inv. inicial (prorrateado)
                      </td>
                      <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                        ${fmtCop(openingShare)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="pt-2" style={{ fontWeight: 700 }}>Margen del periodo</td>
                    <td
                      className="text-end pt-2"
                      style={{
                        color: pnlColor(subsetMargen),
                        fontWeight: 700,
                        fontSize: '1rem',
                      }}
                    >
                      {fmtSignedCop(subsetMargen)}{' '}
                      <span className="small" style={{ color: '#64748b' }}>
                        ({fmtPctVal(subsetMargenPct)})
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#94a3b8', fontSize: 10, paddingTop: 6 }}>Cobertura FIFO</td>
                    <td
                      className="text-end"
                      style={{
                        color: subsetKgSinCobertura > 1 ? '#b45309' : '#15803d',
                        fontSize: 10,
                        paddingTop: 6,
                      }}
                    >
                      {fmtKg(subsetKgCubierto)} / {fmtKg(subsetKgVendido)} kg verde{' '}
                      {subsetKgSinCobertura > 1 && (
                        <span>
                          · sin cobertura: <strong>{fmtKg(subsetKgSinCobertura)} kg</strong>
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2" style={{ fontSize: 10, color: '#92400e' }}>
                {fmtKg(subsetKgVendido)} kg verde vendidos
                · {fifo.perVenta.filter((v) => monthSet.has(v.mes)).length} facturas
              </div>
            </div>
          </div>
        )}

        {/* MARGEN ACUMULADO (siempre visible) */}
        <div className={hasMonth ? 'col-md-6' : 'col-md-12'}>
          <div style={SECTION}>
            <div style={LABEL_STYLE}>
              Margen acumulado{' '}
              <span style={{ color: '#92400e', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                (todo el periodo)
              </span>
            </div>
            <table style={TABLE_STYLE}>
              <tbody>
                <tr>
                  <td style={{ color: '#64748b', paddingBottom: 4 }}>Ventas totales</td>
                  <td className="text-end" style={{ color: '#1e293b', fontWeight: 600, paddingBottom: 4 }}>
                    ${fmtCop(fifo.totalRevenue)}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', paddingBottom: 4 }}>− Costo FIFO (compras del año)</td>
                  <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                    ${fmtCop(fifo.totalCogs)}
                  </td>
                </tr>
                {openingCop > 0 && (
                  <tr>
                    <td
                      style={{ color: '#64748b', paddingBottom: 4 }}
                      title="Costo del inventario inicial del ciclo anterior"
                    >
                      − Inv. inicial (ciclo anterior)
                    </td>
                    <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                      ${fmtCop(openingCop)}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="pt-2" style={{ fontWeight: 700 }}>Margen acumulado</td>
                  <td
                    className="text-end pt-2"
                    style={{
                      color: pnlColor(cumMargen),
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    {fmtSignedCop(cumMargen)}{' '}
                    <span className="small" style={{ color: '#64748b' }}>
                      ({fmtPctVal(cumMargenPct)})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#94a3b8', fontSize: 10, paddingTop: 6 }}>Cobertura FIFO</td>
                  <td
                    className="text-end"
                    style={{
                      color: fifo.totalKgSinCobertura > 1 ? '#b45309' : '#15803d',
                      fontSize: 10,
                      paddingTop: 6,
                    }}
                  >
                    {fmtKg(fifo.totalKgCubierto)} / {fmtKg(fifo.totalKgVendido)} kg verde
                    {fifo.totalKgSinCobertura > 1 && (
                      <span>
                        {' '}· sin cobertura: <strong>{fmtKg(fifo.totalKgSinCobertura)} kg</strong>
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2" style={{ fontSize: 10, color: '#92400e' }}>
              Compras: {fmtKg(fifo.totalKgComprado)} kg verde · ${fmtCopCompact(totalCompraCumCop)}
              {' '}· Remanente en inventario: <strong>{fmtKg(fifo.kgCompraRemanente)} kg verde</strong>
              <br />
              Ventas: {fmtKg(fifo.totalKgVendido)} kg verde · ${fmtCopCompact(fifo.totalRevenue)}
              {' '}({fifo.perVenta.length} facturas)
            </div>
          </div>
        </div>
      </div>

      {fifo.totalKgSinCobertura > 1 && openingCop === 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#fef3c7',
            borderLeft: '3px solid #d97706',
            fontSize: 11,
            color: '#78350f',
          }}
        >
          <strong>⚠ Kg sin cobertura FIFO:</strong> {fmtKg(fifo.totalKgSinCobertura)} kg verde
          vendidos exceden las compras registradas del año. Ingresa el <em>Costo inventario
          inicial (COP)</em> arriba para incorporar el valor del stock del ciclo anterior al COGS.
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          background: '#fafafa',
          borderLeft: '3px solid #f59e0b',
          fontSize: 11,
          color: '#475569',
        }}
      >
        <strong>Metodologia:</strong> COGS = FIFO cronologico sobre las compras del año (mas
        viejas primero) + costo del inventario inicial. Compras: kg verde = arrobas × 12.5.
        Ventas: kg verde = kg × factor por producto. Margen % calculado sobre ventas.
        El inventario inicial se distribuye proporcional a los kg vendidos del periodo cuando
        se filtra por mes.
      </div>
    </div>
  );
}
