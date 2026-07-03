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
import { useEffect, useMemo } from 'react';
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

// Al cambiar de empresa, limpiamos cualquier valor de inventario inicial
// que hubiera quedado en localStorage (concepto retirado en julio 2026 —
// margen bruto = ventas - compras del año, sin ajuste por stock previo).
const OPENING_COP_LS_KEY = (companyId: string) => `cafe_opening_cop:${companyId}`;

function clearOpeningCopIfAny(companyId: string): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.removeItem(OPENING_COP_LS_KEY(companyId));
  } catch {
    // ignore
  }
}

const MES_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

// (fmtKg y fmtCopCompact removidos — la UI simplificada solo usa fmtCop/fmtSignedCop)

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
      } else {
        const consume = Math.min(kgRest, c.kgRemaining);
        cogs += consume * c.precioPorKg;
        c.kgRemaining -= consume;
        kgRest -= consume;
        kgCubierto += consume;
        if (c.kgRemaining <= 1e-9) cIdx += 1;
      }
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

  const monthsLabel = ((): string | null => {
    if (monthsSelected.length === 0) return null;
    if (monthsSelected.length === 1) return MES_NAMES[monthsSelected[0] - 1];
    if (monthsSelected.length <= 3) return monthsSelected.map((m) => MES_NAMES[m - 1]).join(', ');
    return `${monthsSelected.length} meses`;
  })();

  // Julio 2026: concepto de inventario inicial COP eliminado. El margen bruto
  // se calcula como (Ventas − Costos de compras del año) / Ventas. Al montar
  // limpiamos cualquier valor viejo que haya quedado en localStorage.
  useEffect(() => {
    clearOpeningCopIfAny(companyId);
  }, [companyId]);

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

  // Costo del subset = compras del mismo periodo (no FIFO cronologico).
  // El FIFO extenderia el costo a compras de meses posteriores cuando las
  // ventas del periodo superan las compras del periodo, distorsionando el
  // margen bruto por periodo. Para el acumulado (todo el año) FIFO y
  // "compras del año" dan lo mismo — sin cambio ahí.
  const subsetCogs = useMemo(() => {
    if (!hasMonth) return 0;
    return comprasRows
      .filter((c) => {
        const m = parseInt((c.fecha || '').slice(5, 7), 10);
        return monthSet.has(m);
      })
      .reduce((s, c) => s + c.totalCop, 0);
  }, [comprasRows, monthSet, hasMonth]);

  // Margen bruto = Ventas − Costos del año, sin inventario inicial.
  const subsetMargen = subsetRevenue - subsetCogs;
  const subsetMargenPct = subsetRevenue > 0 ? (subsetMargen / subsetRevenue) * 100 : 0;

  const cumMargen = fifo.totalRevenue - fifo.totalCogs;
  const cumMargenPct = fifo.totalRevenue > 0 ? (cumMargen / fifo.totalRevenue) * 100 : 0;

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
          🎯 Margen Bruto Compras ↔ Ventas Café · <span style={{ fontSize: 11, color: '#92400e', fontWeight: 500 }}>Ventas − Compras del año</span>
        </h6>
        <div className="small" style={{ color: '#92400e' }}>
          {monthsLabel
            ? <>Vista: <strong>{monthsLabel}</strong> · acumulado</>
            : <>Vista: <strong>Acumulado</strong> (todo el periodo)</>}
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
                      title="Compras del año registradas cuyo fecha_compra cae en los meses seleccionados"
                    >
                      − Compras del periodo
                    </td>
                    <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                      ${fmtCop(subsetCogs)}
                    </td>
                  </tr>
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
                </tbody>
              </table>
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
                  <td style={{ color: '#64748b', paddingBottom: 4 }}>− Costo compras del año</td>
                  <td className="text-end" style={{ color: '#475569', paddingBottom: 4 }}>
                    ${fmtCop(fifo.totalCogs)}
                  </td>
                </tr>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
