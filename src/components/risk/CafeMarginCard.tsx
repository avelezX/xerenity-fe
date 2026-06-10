/**
 * Card de margen Compras vs Ventas para Cafe.
 *
 * Renderiza debajo del Blotter Ventas (en /risk-management tab Benchmark).
 * Lee los totales que cada blotter emite via onTotalsChange y muestra:
 *   - Precio/Kg verde (COP) ponderado de cada lado + diff
 *   - Precio/Saco (COP) ponderado de cada lado + diff
 *   - Volumen total comprado vs vendido (kg verde)
 *   - Totales nominales
 *
 * Si uno de los dos blotters esta vacio (filas=0), el card muestra un
 * placeholder con guion. La motivacion es que el usuario vea desde el
 * primer momento que la celda esta lista pero falta data.
 */
import type { ComprasTotals } from 'src/components/risk/BlotterCompraCafe';
import type { VentasTotals } from 'src/components/risk/BlotterVentasCafe';

interface Props {
  compras: ComprasTotals | null;
  ventas: VentasTotals | null;
}

const fmtCop = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtKg = (v: number): string =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtCopMillones = (v: number): string => {
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)} MM`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)} M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)} K`;
  return `$${Math.round(v)}`;
};

const fmtSignedCop = (v: number): string => {
  if (v === 0) return '$0';
  const abs = new Intl.NumberFormat('es-CO').format(Math.round(Math.abs(v)));
  return `${v > 0 ? '+$' : '−$'}${abs}`;
};

const fmtPct = (compra: number, venta: number): string => {
  if (compra <= 0) return '—';
  const pct = ((venta - compra) / compra) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

export default function CafeMarginCard({ compras, ventas }: Props) {
  const hasData = (compras?.filas ?? 0) > 0 && (ventas?.filas ?? 0) > 0;

  const margenKg = (ventas?.precioKgCopPond ?? 0) - (compras?.precioKgCopPond ?? 0);
  const margenSaco = (ventas?.precioSacoCopPond ?? 0) - (compras?.precioSacoCopPond ?? 0);
  const margenPctKg = fmtPct(compras?.precioKgCopPond ?? 0, ventas?.precioKgCopPond ?? 0);
  // eslint-disable-next-line no-nested-ternary
  const margenColor = margenKg > 0 ? '#15803d' : margenKg < 0 ? '#b91c1c' : '#475569';

  return (
    <div
      className="mt-4 p-3"
      style={{
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: 6,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0" style={{ color: '#854d0e', fontWeight: 600 }}>
          🎯 Margen Compras ↔ Ventas Café
        </h6>
        {!hasData && (
          <span className="small text-muted">
            (necesita compras + ventas registradas)
          </span>
        )}
      </div>

      <div className="row g-3">
        {/* Precio / Kg verde */}
        <div className="col-md-6">
          <div
            style={{
              background: '#fff',
              border: '1px solid #fde68a',
              borderRadius: 4,
              padding: '12px 16px',
            }}
          >
            <div className="text-muted small mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Precio / Kg verde (COP)
            </div>
            <table className="w-100 small" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tbody>
                <tr>
                  <td className="text-muted">Compra (pond.)</td>
                  <td className="text-end fw-semibold" style={{ color: '#1e293b' }}>
                    ${fmtCop(compras?.precioKgCopPond ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">Venta (pond.)</td>
                  <td className="text-end fw-semibold" style={{ color: '#1e293b' }}>
                    ${fmtCop(ventas?.precioKgCopPond ?? 0)}
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="pt-2 fw-semibold">Margen</td>
                  <td
                    className="text-end pt-2 fw-bold"
                    style={{ color: margenColor, fontSize: '1rem' }}
                  >
                    {fmtSignedCop(margenKg)}{' '}
                    <span className="small text-muted">({margenPctKg})</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Precio / Saco */}
        <div className="col-md-6">
          <div
            style={{
              background: '#fff',
              border: '1px solid #fde68a',
              borderRadius: 4,
              padding: '12px 16px',
            }}
          >
            <div className="text-muted small mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Precio / Saco 70 kg (COP)
            </div>
            <table className="w-100 small" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tbody>
                <tr>
                  <td className="text-muted">Compra (pond.)</td>
                  <td className="text-end fw-semibold" style={{ color: '#1e293b' }}>
                    ${fmtCop(compras?.precioSacoCopPond ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted">Venta (pond.)</td>
                  <td className="text-end fw-semibold" style={{ color: '#1e293b' }}>
                    ${fmtCop(ventas?.precioSacoCopPond ?? 0)}
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="pt-2 fw-semibold">Margen</td>
                  <td
                    className="text-end pt-2 fw-bold"
                    style={{ color: margenColor, fontSize: '1rem' }}
                  >
                    {fmtSignedCop(margenSaco)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Linea de cobertura volumetrica */}
      <div className="mt-3 small text-muted d-flex flex-wrap gap-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span>
          <strong style={{ color: '#1e293b' }}>{fmtKg(compras?.kgVerdeTotal ?? 0)} kg</strong> verde comprados
          {' '}({compras?.filas ?? 0} compras)
        </span>
        <span>·</span>
        <span>
          <strong style={{ color: '#1e293b' }}>{fmtKg(ventas?.kgTotal ?? 0)} kg</strong> vendidos
          {' '}({ventas?.filas ?? 0} ventas)
        </span>
        <span>·</span>
        <span>
          Total compra: <strong style={{ color: '#1e293b' }}>{fmtCopMillones(compras?.totalCop ?? 0)}</strong>
        </span>
        <span>·</span>
        <span>
          Total venta: <strong style={{ color: '#1e293b' }}>{fmtCopMillones(ventas?.totalCop ?? 0)}</strong>
        </span>
      </div>
    </div>
  );
}
