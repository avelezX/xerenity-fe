'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { CoreLayout } from '@layout';
import { Container, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faShieldAlt,
  faSyncAlt,
  faChartPie,
  faBriefcase,
  faDollarSign,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import { fetchBenchmarkFactors, fetchFuturesPortfolio, fetchExposure } from 'src/models/risk/riskApi';
import type {
  BenchmarkFactorsResponse,
  FuturesPosition,
  ExposureResponse,
  ResumenData,
  CommoditiesResumen,
  CommodityRow,
} from 'src/types/risk';
import { fetchResumenData } from 'src/lib/risk/resumenCalculator';
import { fetchCompanyRiskConfig, getAssetsWithCurrency, DEFAULT_EXPOSURE_PARAMS } from 'src/lib/risk/companyConfig';
import { fetchNdfLiquidations } from 'src/models/trading';
import { sumLiquidationsInMonth } from 'src/lib/trading/historicalPositions';
import type { RiskCompanyConfig } from 'src/lib/risk/companyConfig';

const PAGE_TITLE = 'Resumen — Gestión de Riesgos';

const DEFAULT_ASSETS = ['MAIZ', 'AZUCAR', 'CACAO', 'USD'];

// Helpers de fecha viven en src/lib/risk/dateHelpers. La fecha global
// llega via useAppStore (selector global en CoreLayout).

function fmtCompact(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function pnlClass(v: number | null | undefined): string {
  if (v == null) return '';
  if (v > 0) return 'text-success';
  if (v < 0) return 'text-danger';
  return '';
}

/** Map benchmark asset → exposicion natural en USD desde fetchExposure.
 *  Misma logica que /risk-management. Los precios vienen del fin de mes
 *  porque fetchExposure se llama con la filterDate del Resumen.
 */
function getExposureForAsset(asset: string, result: ExposureResponse | null): number | null {
  if (!result?.commodities) return null;
  const find = (name: string) => result.commodities.find((c) => c.nombre === name)?.exposicion_usd ?? 0;
  switch (asset) {
    case 'AZUCAR': return -Math.abs(find('AZUCAR'));
    // MAIZ: Glucosa + Almidon (ambos derivan del precio del futuro ZC).
    case 'MAIZ': return -Math.abs(find('MAIZ') + find('ALMIDON'));
    case 'CACAO': return -Math.abs(find('COCOA_POLVO') + find('MANTECA_CACAO') + find('LICOR_CACAO'));
    case 'USD': return Math.abs(result.exposicion_real_usd ?? 0);
    default: return null;
  }
}

/** Build the Commodities section of the Resumen.
 *  Replica la logica del Benchmark + auto-fill desde Portafolio GR (futuros) +
 *  fila USD desde el store OTC (FX delta + P&L MTD USD).
 */
function buildCommoditiesResumen(
  assets: string[],
  factors: BenchmarkFactorsResponse | null,
  futures: FuturesPosition[],
  exposure: ExposureResponse | null,
  otcFxDelta: number,
  otcPnlMtdUsd: number | null,
  // Suma realized_pnl_usd de las liquidaciones NDF del mes (yearMonth de filterDate).
  // Se agrega al pnl_gr de la fila USD para que el realized de NDFs liquidados
  // ese mes sume al P&G GR del USD row (al lado del unrealized MTD del OTC).
  liquidationsThisMonthUsd: number,
  filterDate: string,
): CommoditiesResumen {
  const PRICE_TO_USD: Record<string, number> = { MAIZ: 0.01, AZUCAR: 0.01, CACAO: 1 };
  const filterMonth = filterDate.slice(0, 7);

  const rows: CommodityRow[] = assets.map((asset) => {
    const f = factors?.factors?.[asset];
    const expNat = getExposureForAsset(asset, exposure);
    const pStart = f?.price_start ?? null;
    const pEnd = f?.price_end ?? null;

    let positionGr = 0;
    let pnlGr = 0;

    if (asset === 'USD') {
      // USD row: Portafolio GR = FX Delta total, P&G GR = P&L MTD USD +
      // liquidaciones realizadas en el mes (unrealized + realized del periodo).
      positionGr = otcFxDelta;
      pnlGr = (otcPnlMtdUsd ?? 0) + liquidationsThisMonthUsd;
    } else {
      // Commodity rows: from futures portfolio (entry_price × multiplier × nominal × toUsd)
      const positions = futures.filter(
        (p) => p.asset === asset && p.entry_date != null && p.entry_date <= filterDate,
      );
      const toUsd = PRICE_TO_USD[asset] ?? 1;

      positions.forEach((p) => {
        const mult = p.multiplier ?? 1;
        const nom = p.nominal ?? 0;
        const entryPrice = p.entry_price ?? 0;
        const dirSign = p.direction === 'LONG' ? 1 : -1;
        positionGr += entryPrice * mult * nom * toUsd;

        if (pStart != null && pEnd != null) {
          const entryMonth = (p.entry_date ?? '').slice(0, 7);
          const startPx = entryMonth === filterMonth ? entryPrice : pStart;
          pnlGr += (pEnd - startPx) * mult * nom * dirSign * toUsd;
        }
      });
    }

    // P&G Super = (price_end - price_start) * super / price_start  (USD)
    let pnlSuper = 0;
    if (pStart != null && pEnd != null && pStart !== 0 && expNat != null) {
      pnlSuper = ((pEnd - pStart) * expNat) / pStart;
    }

    const total = (expNat ?? 0) + positionGr;
    const pnlTotal = pnlSuper + pnlGr;

    return {
      asset,
      contract: f?.contract ?? null,
      exposicion_natural: expNat,
      portafolio_gr: positionGr !== 0 ? positionGr : null,
      total: total !== 0 ? total : null,
      pnl_super: pnlSuper !== 0 ? pnlSuper : null,
      pnl_gr: pnlGr !== 0 ? pnlGr : null,
      pnl_total: pnlTotal !== 0 ? pnlTotal : null,
    };
  });

  // Totals (sum across all asset rows)
  const sum = (key: keyof CommodityRow): number => rows.reduce((s, r) => {
    const v = r[key];
    return s + (typeof v === 'number' ? v : 0);
  }, 0);

  return {
    rows,
    totals: {
      asset: 'Total',
      contract: null,
      exposicion_natural: sum('exposicion_natural'),
      portafolio_gr: sum('portafolio_gr'),
      total: sum('total'),
      pnl_super: sum('pnl_super'),
      pnl_gr: sum('pnl_gr'),
      pnl_total: sum('pnl_total'),
    },
  };
}

function RiskResumenPage() {
  const { userProfile, isSuperAdmin, selectedCompanyId, setSelectedCompanyId } = useAppStore();

  // OTC store handles — used to detect whether positions are loaded.
  // Reads of summary / fx_delta / refPrices.mtd are done after the reprice
  // promise resolves via useAppStore.getState() inside handleFetch (so we
  // always see the freshest values, not the snapshot at render time).
  const pricedXccyStore = useAppStore((s) => s.pricedXccy);
  const pricedNdfStore = useAppStore((s) => s.pricedNdf);
  const tradingLoading = useAppStore((s) => s.tradingLoading);
  const loadOtcPositions = useAppStore((s) => s.loadPositions);
  const repriceWithMark = useAppStore((s) => s.repriceAllWithMark);
  const loadOtcRefPrices = useAppStore((s) => s.loadReferencePrices);

  // Default empresa = own company (when global selector hasn't picked one)
  useEffect(() => {
    if (userProfile?.company_id && !selectedCompanyId) {
      setSelectedCompanyId(userProfile.company_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.company_id]);

  // Company config
  const [companyConfig, setCompanyConfig] = useState<RiskCompanyConfig | null>(null);
  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyConfig(null);
      return;
    }
    fetchCompanyRiskConfig(selectedCompanyId)
      .then((cfg) => setCompanyConfig(cfg))
      .catch(() => setCompanyConfig(null));
  }, [selectedCompanyId]);

  const dynamicAssets = useMemo(
    () => (companyConfig ? getAssetsWithCurrency(companyConfig) : DEFAULT_ASSETS),
    [companyConfig],
  );

  // Fecha global del modulo de Riesgos. Viene del selector en CoreLayout
  // (Zustand, persistido en localStorage). Esta pagina ya no tiene
  // selector propio — todas las paginas de Riesgos comparten la misma fecha.
  const filterDate = useAppStore((s) => s.globalEvaluationDate);

  // Resumen state
  const [resumenData, setResumenData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(false);

  /** Master fetch — OTC + commodities + credits, all anchored to `filterDate`. */
  const handleFetch = useCallback(async () => {
    if (!selectedCompanyId || !companyConfig) return;
    setLoading(true);
    try {
      const commodityCfg = companyConfig?.commodities ?? [];

      // 1) OTC: load positions if missing, reprice with the selected mark date,
      //    then load reference prices ANCHORED a filterDate (no a prevMonthDate).
      //    loadReferencePrices internamente computa via computePnlRefDates las
      //    3 fechas de referencia: daily = D-1, mtd = ult dia habil mes anterior,
      //    ytd = ult dia habil diciembre anterior. Si le pasamos prevMonthDate
      //    queda todo desfasado un mes y P&L MTD termina dando = NPV (porque la
      //    referencia mtd queda apuntando al mes equivocado / sin marca).
      const hasOtc = (pricedXccyStore?.length ?? 0) + (pricedNdfStore?.length ?? 0) > 0;
      if (!hasOtc) {
        await loadOtcPositions(selectedCompanyId);
      }
      // Cargar liquidaciones NDF (audit trail) para reconstruir notional
      // historico de NDFs liquidados despues de filterDate. Sin esto, los
      // valores de NPV/FX Delta/P&L MTD para meses pasados quedan
      // subestimados porque ndf_position.notional_usd ya esta en 0.
      const liqResult = await fetchNdfLiquidations();
      const liquidationsList = liqResult.error ? [] : liqResult.data;
      await repriceWithMark(filterDate, liquidationsList);
      await loadOtcRefPrices(filterDate, liquidationsList);

      // 2) Commodities: benchmark factors + futures + exposicion (condicional)
      //    Solo llamar fetchExposure si la empresa tiene exposure_defaults
      //    configurados. DEFAULT_EXPOSURE_PARAMS son especificos de Super de
      //    Alimentos — si se llaman para otra empresa, muestra datos incorrectos
      //    ($82.7M de exposicion USD que es de Super, no del Embrujo).
      const hasExposureConfig = companyConfig?.exposure_defaults
        && Object.keys(companyConfig.exposure_defaults).length > 0;
      // Mergea los exposure_defaults persistidos por la empresa sobre el
      // DEFAULT base (Super de Alimentos) — asi cada empresa usa SUS KG
      // anuales, proyecciones y fletes, no los de Super.
      const mergedExposureParams = hasExposureConfig
        ? { ...DEFAULT_EXPOSURE_PARAMS, ...(companyConfig!.exposure_defaults as Partial<typeof DEFAULT_EXPOSURE_PARAMS>) }
        : DEFAULT_EXPOSURE_PARAMS;

      const [factors, futResp, exposure] = await Promise.all([
        fetchBenchmarkFactors(filterDate, 0.99, companyConfig).catch(() => null),
        fetchFuturesPortfolio(filterDate, true, selectedCompanyId, commodityCfg).catch(() => ({ portfolio: [] as FuturesPosition[] })),
        hasExposureConfig
          ? fetchExposure(filterDate, mergedExposureParams).catch(() => null as ExposureResponse | null)
          : Promise.resolve(null as ExposureResponse | null),
      ]);

      // 3) FX delta + P&L MTD from store (refresh after reprice/refprice resolved)
      const state = useAppStore.getState();
      const fxDeltaTotal = (state.pricedXccy ?? []).reduce((s, p) => s + (p.fx_delta ?? 0), 0)
        + (state.pricedNdf ?? []).reduce((s, p) => s + (p.fx_delta ?? 0), 0);
      const summary = state.summary as { total_npv_cop: number; total_npv_usd: number } | null;
      const mtdRef = state.refPrices?.mtd;
      const pnlMtdCop = (summary && mtdRef)
        ? summary.total_npv_cop - mtdRef.summary.total_npv_cop
        : undefined;
      const pnlMtdUsd = (summary && mtdRef)
        ? summary.total_npv_usd - mtdRef.summary.total_npv_usd
        : undefined;

      // 4) Build the commodities table — feeds USD row from OTC store +
      // suma de liquidaciones NDF realizadas en el mes de filterDate.
      const filterMonth = filterDate.slice(0, 7);
      const liquidationsThisMonthUsd = sumLiquidationsInMonth(liquidationsList, filterMonth).usd;
      const commodities = buildCommoditiesResumen(
        dynamicAssets,
        factors,
        futResp.portfolio,
        exposure,
        fxDeltaTotal,
        pnlMtdUsd ?? null,
        liquidationsThisMonthUsd,
        filterDate,
      );

      // 5) Compose the Resumen via the existing helper (handles credits)
      const data = await fetchResumenData(filterDate, selectedCompanyId, {
        summary: summary ?? undefined,
        fxDeltaTotal,
        pnlMtdCop,
        pnlMtdUsd,
        commoditiesOverride: commodities,
      });
      setResumenData(data);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Error cargando resumen');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, companyConfig, filterDate, dynamicAssets]);

  // Auto-fetch on month change / company change
  useEffect(() => {
    handleFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, selectedCompanyId, companyConfig]);

  return (
    <CoreLayout>
      <RoleGuard requiredRole="corp_admin" fallback={
        <Container fluid className="p-4">
          <p className="text-muted">No tienes acceso a esta sección. Contacta a tu administrador.</p>
        </Container>
      }>
        {!selectedCompanyId && userProfile && !isSuperAdmin() && (
          <Container fluid className="p-4 text-center py-5">
            <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
            <h5>Sin empresa asignada</h5>
            <p className="text-muted">Tu cuenta no tiene una empresa asociada. Contacta a tu administrador.</p>
          </Container>
        )}
        {!selectedCompanyId && isSuperAdmin() && (
          <Container fluid className="p-4 text-center py-5">
            <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
            <h5>Selecciona una empresa</h5>
            <p className="text-muted">Usa el selector de empresa en la barra superior para ver el resumen.</p>
          </Container>
        )}
        {selectedCompanyId && !companyConfig && (
          <Container fluid className="p-4 text-center py-5">
            <Icon icon={faShieldAlt} size="3x" className="text-muted mb-3" />
            <h5>Configuración pendiente</h5>
            <p className="text-muted">
              Esta empresa aún no tiene configurados los commodities. Ve a{' '}
              <Link href="/risk-management">Commodities</Link> para configurarlos.
            </p>
          </Container>
        )}

        {selectedCompanyId && companyConfig && (
          <Container fluid className="p-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <PageTitle>
                <Icon icon={faChartPie} />
                <h4>{PAGE_TITLE}</h4>
              </PageTitle>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleFetch}
                disabled={loading || tradingLoading}
                title="Recarga commodities, OTC y créditos para el mes seleccionado"
              >
                <Icon icon={faSyncAlt} className={(loading || tradingLoading) ? 'fa-spin me-1' : 'me-1'} />
                Actualizar
              </Button>
            </div>

            {/* El selector de mes vive en CoreLayout (barra superior global).
                Esta pagina lee `filterDate` del store y se actualiza
                automaticamente. */}

            {(loading || tradingLoading) && <p className="text-muted">Cargando resumen...</p>}

            {resumenData && (
              <>
                {/* COMMODITIES */}
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h6 style={{ color: '#7c3aed', marginBottom: 16, fontWeight: 700 }}>
                    <Icon icon={faChartPie} className="me-2" />Commodities
                  </h6>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0" style={{ fontSize: '0.8rem', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ verticalAlign: 'middle', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem' }}>Activo</th>
                          <th colSpan={3} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>Posiciones</th>
                          <th colSpan={3} className="text-center" style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 700, fontSize: '0.75rem' }}>P&G</th>
                        </tr>
                        <tr style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0' }}>Exposición Natural</th>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', color: '#d97706' }}>Portafolio GR</th>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0' }}>Total</th>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0' }}>Super</th>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0', color: '#d97706' }}>GR</th>
                          <th className="text-end" style={{ borderBottom: '2px solid #e2e8f0' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenData.commodities.rows.map((row) => (
                          <tr key={row.asset} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 4px' }}>
                              <span style={{ color: '#7c3aed', fontWeight: 600 }}>{row.asset}</span>
                              {row.contract && <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}> ({row.contract})</span>}
                            </td>
                            <td className="text-end" style={{ padding: '8px 4px' }}>{fmtCompact(row.exposicion_natural)}</td>
                            <td className="text-end" style={{ padding: '8px 4px' }}>{fmtCompact(row.portafolio_gr)}</td>
                            <td className="text-end" style={{ padding: '8px 4px', fontWeight: 600 }}>{fmtCompact(row.total)}</td>
                            <td className={`text-end ${pnlClass(row.pnl_super)}`} style={{ padding: '8px 4px' }}>{fmtCompact(row.pnl_super)}</td>
                            <td className={`text-end ${pnlClass(row.pnl_gr)}`} style={{ padding: '8px 4px' }}>{fmtCompact(row.pnl_gr)}</td>
                            <td className={`text-end ${pnlClass(row.pnl_total)}`} style={{ padding: '8px 4px', fontWeight: 600 }}>{fmtCompact(row.pnl_total)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #1e293b' }}>
                          <td style={{ padding: '8px 4px', fontWeight: 700 }}>Total</td>
                          <td className="text-end" style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.exposicion_natural)}</td>
                          <td className="text-end" style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.portafolio_gr)}</td>
                          <td className="text-end" style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.total)}</td>
                          <td className={`text-end ${pnlClass(resumenData.commodities.totals.pnl_super)}`} style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.pnl_super)}</td>
                          <td className={`text-end ${pnlClass(resumenData.commodities.totals.pnl_gr)}`} style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.pnl_gr)}</td>
                          <td className={`text-end ${pnlClass(resumenData.commodities.totals.pnl_total)}`} style={{ padding: '8px 4px', fontWeight: 700 }}>{fmtCompact(resumenData.commodities.totals.pnl_total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DERIVADOS OTC */}
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h6 style={{ color: '#7c3aed', marginBottom: 16, fontWeight: 700 }}>
                    <Icon icon={faBriefcase} className="me-2" />Derivados OTC — {resumenData.otc.posiciones} posiciones
                  </h6>
                  <Row className="g-2">
                    {[
                      { label: 'NPV COP', value: resumenData.otc.npv_cop },
                      { label: 'NPV USD', value: resumenData.otc.npv_usd },
                      { label: 'FX Delta', value: resumenData.otc.fx_delta },
                      { label: 'P&L MTD COP', value: resumenData.otc.pnl_mtd_cop },
                      { label: 'P&L MTD USD', value: resumenData.otc.pnl_mtd_usd },
                    ].map((item) => {
                      const colorRaw = pnlClass(item.value);
                      let color = '#1e293b';
                      if (colorRaw.includes('success')) color = '#16a34a';
                      else if (colorRaw.includes('danger')) color = '#dc2626';
                      return (
                        <Col key={item.label} xs={6} md>
                          <div style={{ textAlign: 'center', padding: '10px 6px', background: '#f8fafc', borderRadius: 6 }}>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 2, color }}>
                              {item.value != null ? fmtCompact(item.value) : '—'}
                            </div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </div>

                {/* CRÉDITOS */}
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h6 style={{ color: '#7c3aed', marginBottom: 16, fontWeight: 700 }}>
                    <Icon icon={faDollarSign} className="me-2" />Créditos <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#94a3b8' }}>(snapshot actual)</span>
                  </h6>
                  <Row className="g-3">
                    <Col xs={3}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}># Créditos</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>{resumenData.creditos.total_creditos}</div>
                      </div>
                    </Col>
                    <Col xs={3}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Total</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                          {fmtCompact(resumenData.creditos.deuda_total)}
                        </div>
                      </div>
                    </Col>
                    <Col xs={3}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#dbeafe', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 600 }}>IBR</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                          {resumenData.creditos.creditos_ibr} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b' }}>créditos</span>
                        </div>
                      </div>
                    </Col>
                    <Col xs={3}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#fef3c7', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#d97706', textTransform: 'uppercase', fontWeight: 600 }}>Tasa Fija</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                          {resumenData.creditos.creditos_tasa_fija} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748b' }}>créditos</span>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </>
            )}
          </Container>
        )}
      </RoleGuard>
    </CoreLayout>
  );
}

export default RiskResumenPage;
