/**
 * VentasHistoricoCard — resumen agregado por CLIENTE de las ventas
 * tipo 'factura_cop' (facturas domesticas COP/kg).
 *
 * Calcula en vivo desde los rows raw que vienen del fetcher de ventas.
 * Por cliente, computa promedios PONDERADOS por kg:
 *
 *   total_kg   = Σ kg_i
 *   total_cop  = Σ kg_i × valor_kilo_i
 *   avg_cop_kg = total_cop / total_kg          (precio ponderado COP/kg)
 *   avg_trm    = Σ (kg_i × trm_dia_i) / Σ kg_i (TRM ponderado)
 *   total_usd  = Σ (kg_i × valor_kilo_i / trm_dia_i)
 *   avg_usd_kg = total_usd / total_kg          (precio ponderado USD/kg)
 *
 * Comparacion con precio futuro KC (NY Coffee C):
 *   precio_kc_equiv_usd_kg = (precio_kc_cents / 100) × 2.20462   [lb→kg]
 *   premium_pct = (avg_usd_kg / kc_equiv − 1) × 100
 *
 * Premium positivo = venta arriba del NY (calidades premium tipo Wizard/Shaman).
 * Premium negativo = venta debajo del NY (PASILLA, descartes, etc.)
 */
import React, { useMemo } from 'react';
import type { CafeVentaRow } from 'src/lib/risk/supabaseRisk';
import { kgVerdeEquiv } from 'src/lib/risk/cafeVerdeFactor';

interface Props {
  rows: CafeVentaRow[];
  /** Precio KC actual en ¢/lb (CAFE front contract). Para exposicion USD. */
  precioKcCents?: number | null;
  /** Libras por contrato KC (default 37,500 ICE Coffee C). */
  lbsPorContrato?: number;
}

interface ClienteAgg {
  cliente: string;
  num_ventas: number;
  total_kg: number;          // kg as-sold (mezcla excelso + pergamino + cereza + pasilla)
  total_kg_verde: number;    // kg verde equivalente (post factor por producto)
  total_cop: number;
  avg_cop_kg: number;        // COP / kg verde equiv (ponderado)
  avg_trm: number | null;    // ponderado por kg verde
  total_usd: number | null;
  avg_usd_kg: number | null; // USD / kg verde equiv (ponderado)
  avg_kc_cents: number | null; // precio KC ponderado por kg verde (¢/lb)
  // Cobertura KC: ventas son SHORT cafe (entregamos fisico). El hedge
  // teorico es venta de futuros = contratos negativos. Mismo signo que
  // BlotterCompraCafe para compras (positivos LONG). Usa kg verde equiv.
  contratos_kc: number;      // negativo (SHORT cafe)
  exposicion_usd: number;    // contratos × 37,500 × precio_KC_actual / 100
  desde: string;
  hasta: string;
  num_productos: number;
}

const LB_PER_KG = 2.20462;

// ── Formatters ─────────────────────────────────────────────

const fmtNum = (v: number, decimals = 0): string =>
  v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const fmtCompactCop = (v: number): string => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const fmtCompactUsd = (v: number): string => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

// ── Styles ─────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────

export default function VentasHistoricoCard({
  rows,
  precioKcCents,
  lbsPorContrato = 37500,
}: Props) {
  const facturas = useMemo(
    () => rows.filter((r) => r.tipo_venta === 'factura_cop' && r.cliente),
    [rows],
  );

  const aggregations = useMemo<ClienteAgg[]>(() => {
    const byCliente: Record<string, CafeVentaRow[]> = {};
    facturas.forEach((r) => {
      const c = r.cliente as string;
      if (!byCliente[c]) byCliente[c] = [];
      byCliente[c].push(r);
    });

    return Object.entries(byCliente).map(([cliente, sales]) => {
      let totalKg = 0;
      let totalKgVerde = 0;       // kg verde equivalente (factor por producto)
      let totalCop = 0;
      let sumKgVerdeTrm = 0;
      let sumKgVerdeWithTrm = 0;
      let totalUsd = 0;
      let sumKgVerdeKc = 0;
      let sumKgVerdeWithKc = 0;
      const fechas: string[] = [];
      const productos = new Set<string>();

      sales.forEach((r) => {
        const kg = r.kg || 0;
        const kgVerde = kgVerdeEquiv(r.producto, kg);
        const vk = r.valor_kilo || 0;
        const trm = r.trm_dia ?? null;
        const kc = r.precio_kc_cents ?? null;
        totalKg += kg;
        totalKgVerde += kgVerde;
        totalCop += kg * vk;       // COP no cambia: es la venta real
        if (trm != null && trm > 0) {
          // Ponderar promedios por kg VERDE para reflejar mejor el producto
          // hedgeable. Las pasilla/cereza con factor 0 no cuentan en los avg.
          sumKgVerdeTrm += kgVerde * trm;
          sumKgVerdeWithTrm += kgVerde;
          totalUsd += (kg * vk) / trm;
        }
        if (kc != null && kc > 0) {
          sumKgVerdeKc += kgVerde * kc;
          sumKgVerdeWithKc += kgVerde;
        }
        fechas.push(r.fecha_fijacion);
        if (r.producto) productos.add(r.producto);
      });

      // Promedios en $/kg verde — comparables con el blotter de compras
      const avgCopKg = totalKgVerde > 0 ? totalCop / totalKgVerde : 0;
      const avgTrm = sumKgVerdeWithTrm > 0 ? sumKgVerdeTrm / sumKgVerdeWithTrm : null;
      const avgKcCents = sumKgVerdeWithKc > 0 ? sumKgVerdeKc / sumKgVerdeWithKc : null;
      const avgUsdKg = avgTrm != null && avgTrm > 0
        ? avgCopKg / avgTrm
        : null;
      // Hedge KC: # contratos = -(kg_verde × 2.20462 / lbs_por_contrato).
      // Usar kg verde excluye pasilla (factor 0) que no se hedgea con KC,
      // y descuenta el pergamino (factor 0.80) al estado verde.
      const contratosKc = lbsPorContrato > 0
        ? -(totalKgVerde * LB_PER_KG) / lbsPorContrato
        : 0;
      const exposicionUsd = precioKcCents != null
        ? contratosKc * lbsPorContrato * precioKcCents / 100
        : 0;

      fechas.sort();
      return {
        cliente,
        num_ventas: sales.length,
        total_kg: totalKg,
        total_kg_verde: totalKgVerde,
        total_cop: totalCop,
        avg_cop_kg: avgCopKg,
        avg_trm: avgTrm,
        total_usd: avgTrm != null ? totalUsd : null,
        avg_usd_kg: avgUsdKg,
        avg_kc_cents: avgKcCents,
        contratos_kc: contratosKc,
        exposicion_usd: exposicionUsd,
        desde: fechas[0] ?? '—',
        hasta: fechas[fechas.length - 1] ?? '—',
        num_productos: productos.size,
      };
    }).sort((a, b) => b.total_cop - a.total_cop);
  }, [facturas, lbsPorContrato, precioKcCents]);

  const totals = useMemo(() => {
    let totalKg = 0;
    let totalKgVerde = 0;
    let totalCop = 0;
    let totalUsd = 0;
    let sumKgVerdeWithTrm = 0;
    let totalContratosKc = 0;
    let totalExposicionUsd = 0;
    aggregations.forEach((a) => {
      totalKg += a.total_kg;
      totalKgVerde += a.total_kg_verde;
      totalCop += a.total_cop;
      if (a.total_usd != null) {
        totalUsd += a.total_usd;
        sumKgVerdeWithTrm += a.total_kg_verde;
      }
      totalContratosKc += a.contratos_kc;
      totalExposicionUsd += a.exposicion_usd;
    });
    return {
      num_ventas: facturas.length,
      num_clientes: aggregations.length,
      total_kg: totalKg,
      total_kg_verde: totalKgVerde,
      total_cop: totalCop,
      avg_cop_kg: totalKgVerde > 0 ? totalCop / totalKgVerde : 0,
      total_usd: sumKgVerdeWithTrm > 0 ? totalUsd : null,
      avg_usd_kg: sumKgVerdeWithTrm > 0 ? totalUsd / sumKgVerdeWithTrm : null,
      contratos_kc: totalContratosKc,
      exposicion_usd: totalExposicionUsd,
    };
  }, [aggregations, facturas]);

  if (aggregations.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
    }}
    >
      {/* Header con KPIs */}
      <div style={{
        padding: '14px 18px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            Historico de ventas por cliente
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {totals.num_clientes} clientes · {totals.num_ventas} facturas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 11, fontFamily: 'monospace' }}>
          <div>
            <span style={{ color: '#64748b' }}>Kg vendidos:</span>{' '}
            <strong style={{ color: '#0f172a' }}>{fmtNum(totals.total_kg)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Kg verde:</span>{' '}
            <strong style={{ color: '#15803d' }}>{fmtNum(totals.total_kg_verde)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Total COP:</span>{' '}
            <strong style={{ color: '#16a34a' }}>{fmtCompactCop(totals.total_cop)}</strong>
          </div>
          {totals.total_usd != null && (
            <div>
              <span style={{ color: '#64748b' }}>Total USD:</span>{' '}
              <strong style={{ color: '#1d4ed8' }}>{fmtCompactUsd(totals.total_usd)}</strong>
            </div>
          )}
          <div>
            <span style={{ color: '#64748b' }}>Avg COP/kg:</span>{' '}
            <strong style={{ color: '#0f172a' }}>${fmtNum(totals.avg_cop_kg, 0)}</strong>
          </div>
          {totals.avg_usd_kg != null && (
            <div>
              <span style={{ color: '#64748b' }}>Avg USD/kg:</span>{' '}
              <strong style={{ color: '#0f172a' }}>${totals.avg_usd_kg.toFixed(2)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Tabla por cliente */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Cliente</th>
              <th style={TH_NUM}>Facturas</th>
              <th style={TH_NUM}>Kg vendido</th>
              <th style={TH_NUM}>Kg verde</th>
              <th style={TH_NUM}>COP total</th>
              <th style={TH_NUM}>Avg COP/kg verde</th>
              <th style={TH_NUM}>Avg TRM</th>
              <th style={TH_NUM}>USD total</th>
              <th style={TH_NUM}>Avg USD/kg</th>
              <th style={TH_NUM}>KC ¢/lb</th>
              <th style={TH_NUM}># Ctos KC</th>
              <th style={TH_NUM}>Exp USD</th>
              <th style={TH}>Periodo</th>
            </tr>
          </thead>
          <tbody>
            {aggregations.map((a) => (
                <tr key={a.cliente}>
                  <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>
                    {a.cliente}
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      {a.num_productos} {a.num_productos === 1 ? 'producto' : 'productos'}
                    </div>
                  </td>
                  <td style={TD_NUM}>{a.num_ventas}</td>
                  <td style={TD_NUM}>{fmtNum(a.total_kg)}</td>
                  <td style={{ ...TD_NUM, color: '#15803d', fontWeight: 600 }}>
                    {fmtNum(a.total_kg_verde)}
                  </td>
                  <td style={{ ...TD_NUM, color: '#16a34a', fontWeight: 600 }}>
                    {fmtCompactCop(a.total_cop)}
                  </td>
                  <td style={TD_NUM}>${fmtNum(a.avg_cop_kg, 0)}</td>
                  <td style={{ ...TD_NUM, color: '#64748b' }}>
                    {a.avg_trm != null ? a.avg_trm.toFixed(0) : '—'}
                  </td>
                  <td style={{ ...TD_NUM, color: '#1d4ed8', fontWeight: 600 }}>
                    {a.total_usd != null ? fmtCompactUsd(a.total_usd) : '—'}
                  </td>
                  <td style={TD_NUM}>
                    {a.avg_usd_kg != null ? `$${a.avg_usd_kg.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...TD_NUM, color: '#64748b' }}>
                    {a.avg_kc_cents != null ? a.avg_kc_cents.toFixed(1) : '—'}
                  </td>
                  <td style={{
                    ...TD_NUM,
                    color: a.contratos_kc < 0 ? '#dc2626' : '#64748b',
                    fontWeight: 600,
                  }}
                  >
                    {a.contratos_kc !== 0 ? a.contratos_kc.toFixed(2) : '—'}
                  </td>
                  <td style={{
                    ...TD_NUM,
                    color: a.exposicion_usd < 0 ? '#dc2626' : '#64748b',
                    fontWeight: 600,
                  }}
                  >
                    {a.exposicion_usd !== 0 ? fmtCompactUsd(a.exposicion_usd) : '—'}
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                    {a.desde}<br />{a.hasta}
                  </td>
                </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
              <td style={{ ...TD, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
                Total {totals.num_clientes} clientes
              </td>
              <td style={TD_NUM}>{totals.num_ventas}</td>
              <td style={TD_NUM}>{fmtNum(totals.total_kg)}</td>
              <td style={{ ...TD_NUM, color: '#15803d' }}>{fmtNum(totals.total_kg_verde)}</td>
              <td style={{ ...TD_NUM, color: '#16a34a' }}>{fmtCompactCop(totals.total_cop)}</td>
              <td style={TD_NUM}>${fmtNum(totals.avg_cop_kg, 0)}</td>
              <td style={TD} />
              <td style={{ ...TD_NUM, color: '#1d4ed8' }}>
                {totals.total_usd != null ? fmtCompactUsd(totals.total_usd) : '—'}
              </td>
              <td style={TD_NUM}>
                {totals.avg_usd_kg != null ? `$${totals.avg_usd_kg.toFixed(2)}` : '—'}
              </td>
              <td style={TD} />
              <td style={{
                ...TD_NUM,
                color: totals.contratos_kc < 0 ? '#dc2626' : '#0f172a',
              }}
              >
                {totals.contratos_kc !== 0 ? totals.contratos_kc.toFixed(2) : '—'}
              </td>
              <td style={{
                ...TD_NUM,
                color: totals.exposicion_usd < 0 ? '#dc2626' : '#0f172a',
              }}
              >
                {totals.exposicion_usd !== 0 ? fmtCompactUsd(totals.exposicion_usd) : '—'}
              </td>
              <td style={TD} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
