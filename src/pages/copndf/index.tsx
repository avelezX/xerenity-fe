'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col } from 'react-bootstrap';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Container from 'react-bootstrap/Container';

import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faLandmark,
  faLineChart,
  faTable,
  faGlobe,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import { CopNdf, CopFwdPoint, NDFCurvePoint } from 'src/types/condf';
import Toolbar from '@components/UI/Toolbar';
import Button from '@components/UI/Button';
import DataTableBase from '@components/Table/BaseDataTable';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import NDFCurveChart, {
  assignTenorBucket,
  bucketOrder,
  bucketMidDays,
} from '@components/yieldCurve/NDFCurveChart';

import NdfColumns from '../../components/Table/columnDefinition/copndf/columns';

const PAGE_TITLE = 'COP NDF';

const TAB_ITEMS: TabItemType[] = [
  { name: 'Curva NDF', property: 'curve', icon: faLineChart, active: true },
  { name: 'DTCC', property: 'dtcc', icon: faTable, active: false },
  { name: 'FXEmpire', property: 'fxe', icon: faGlobe, active: false },
];

function NdfCopViewer() {
  const supabase = createClientComponentClient();

  const [activeTab, setActiveTab] = useState('curve');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [copndfGrid, setCopNdfGrid] = useState<CopNdf[]>([]);
  const [fxeData, setFxeData] = useState<CopFwdPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNDFData = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('cop_ndf_last_day_query')
      .select('*')
      .order('days_diff_effective_expiration', { ascending: true });
    if (error) {
      setCopNdfGrid([]);
      toast.error(error.message);
    } else if (data) {
      setCopNdfGrid(data as CopNdf[]);
    } else {
      setCopNdfGrid([]);
    }
  }, [supabase]);

  const fetchFXEmpireData = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('cop_fwd_points')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(20);
    if (error) {
      setFxeData([]);
    } else if (data && data.length > 0) {
      const latestDate = (data as CopFwdPoint[])[0].fecha;
      setFxeData((data as CopFwdPoint[]).filter((d) => d.fecha === latestDate));
    } else {
      setFxeData([]);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchNDFData(), fetchFXEmpireData()]).then(() => setLoading(false));
  }, [fetchNDFData, fetchFXEmpireData]);

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  // Aggregate raw DTCC data into tenor nodes via volume-weighted average
  const nodeRates = useMemo(() => {
    if (copndfGrid.length === 0) return new Map<string, { rate: number; trades: number; vol: number; minDays: number; maxDays: number }>();

    const bucketMap = new Map<string, { totalRate: number; totalVol: number; totalTrades: number; minDays: number; maxDays: number }>();

    copndfGrid.forEach((row) => {
      const label = assignTenorBucket(row.days_diff_effective_expiration);
      if (!label) return;

      const curr = bucketMap.get(label) || { totalRate: 0, totalVol: 0, totalTrades: 0, minDays: Infinity, maxDays: 0 };
      const vol = row.total_sum_notional_leg_2 || 0;
      const weight = vol > 0 ? vol : 1;
      curr.totalRate += row.median_exchange_rate * weight;
      curr.totalVol += weight;
      curr.totalTrades += row.trade_count;
      curr.minDays = Math.min(curr.minDays, row.days_diff_effective_expiration);
      curr.maxDays = Math.max(curr.maxDays, row.days_diff_effective_expiration);
      bucketMap.set(label, curr);
    });

    const result = new Map<string, { rate: number; trades: number; vol: number; minDays: number; maxDays: number }>();
    bucketMap.forEach((agg, label) => {
      result.set(label, {
        rate: agg.totalRate / agg.totalVol,
        trades: agg.totalTrades,
        vol: agg.totalVol,
        minDays: agg.minDays,
        maxDays: agg.maxDays,
      });
    });
    return result;
  }, [copndfGrid]);

  // Forward-forward devaluation between consecutive DTCC nodes
  const curvePoints = useMemo((): NDFCurvePoint[] => {
    const sortedLabels = Array.from(nodeRates.keys()).sort(
      (a, b) => bucketOrder(a) - bucketOrder(b)
    );
    if (sortedLabels.length < 2) return [];

    const points: NDFCurvePoint[] = [];

    for (let i = 1; i < sortedLabels.length; i += 1) {
      const prevLabel = sortedLabels[i - 1];
      const currLabel = sortedLabels[i];
      const prev = nodeRates.get(prevLabel)!;
      const curr = nodeRates.get(currLabel)!;

      const prevDays = bucketMidDays(prevLabel);
      const currDays = bucketMidDays(currLabel);
      const daysDiff = currDays - prevDays;

      const fwdFwdDeval = (curr.rate / prev.rate - 1) * (360 / daysDiff) * 100;

      points.push({
        days: currDays,
        tenorLabel: currLabel,
        medianRate: curr.rate,
        fwdFwdDeval,
        segment: `${prevLabel}→${currLabel}`,
        tradeCount: curr.trades,
        volumeUSD: curr.vol,
      });
    }

    return points;
  }, [nodeRates]);

  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push(['Plazo', 'Operaciones']);

    copndfGrid.forEach((entry) => {
      allValues.push([
        entry.days_diff_effective_expiration.toString(),
        entry.trade_count.toString(),
      ]);
    });

    const csv = ExportToCsv(allValues);
    downloadBlob(csv, 'xerenity_ndf.csv', 'text/csv;charset=utf-8;');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Row>
          <Col>
            <div
              style={{
                height: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
              }}
            >
              Loading...
            </div>
          </Col>
        </Row>
      );
    }

    // ── Tab: Curva NDF (chart only, both sources) ──
    if (activeTab === 'curve') {
      return (
        <Row>
          <Col>
            <NDFCurveChart rawData={copndfGrid} fxeData={fxeData} />
          </Col>
        </Row>
      );
    }

    // ── Tab: DTCC (nodos + fwd-fwd + raw data) ──
    if (activeTab === 'dtcc') {
      return (
        <>
          {/* Node rates table */}
          {nodeRates.size > 0 && (
            <Row className="mt-3">
              <Col>
                <h6 style={{ marginBottom: 12 }}>Nodos NDF (DTCC)</h6>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tenor</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Días</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>NDF Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}># Trades</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol (USD M)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(nodeRates.entries())
                        .sort((a, b) => bucketOrder(a[0]) - bucketOrder(b[0]))
                        .map(([label, node]) => (
                          <tr key={label} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{label}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', color: '#666', fontSize: 13 }}>
                              {node.minDays === node.maxDays ? node.minDays : `${node.minDays}–${node.maxDays}`}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {node.rate.toFixed(2)}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {node.trades}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {(node.vol / 1e6).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Col>
            </Row>
          )}

          {/* Unclassified data warning */}
          {(() => {
            const classified = Array.from(nodeRates.values()).reduce((s, n) => s + n.trades, 0);
            const total = copndfGrid.reduce((s, r) => s + r.trade_count, 0);
            const unclassified = total - classified;
            if (unclassified <= 0) return null;
            return (
              <Row className="mt-2">
                <Col>
                  <div style={{ fontSize: 13, color: '#999' }}>
                    {unclassified} trades ({copndfGrid.filter(r => !assignTenorBucket(r.days_diff_effective_expiration)).length} plazos) no clasificados en ningún bucket tenor
                  </div>
                </Col>
              </Row>
            );
          })()}

          {/* Forward-forward table */}
          {curvePoints.length > 0 && (
            <Row className="mt-3">
              <Col>
                <h6 style={{ marginBottom: 12 }}>Devaluación Forward-Forward</h6>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Segmento</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Dev. Implícita</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>NDF Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}># Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curvePoints.map((pt) => (
                        <tr key={pt.segment} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>
                            {pt.segment}
                          </td>
                          <td
                            style={{
                              padding: '6px 12px',
                              textAlign: 'right',
                              color: '#2ca02c',
                              fontWeight: 600,
                            }}
                          >
                            {pt.fwdFwdDeval.toFixed(2)}%
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {pt.medianRate.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                            {pt.tradeCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Col>
            </Row>
          )}

          {/* Raw data table */}
          <Row className="mt-4">
            <div className="d-flex justify-content-end pb-3">
              <Toolbar>
                <Button variant="outline-primary" onClick={downloadSeries}>
                  <Icon icon={faFileCsv} className="mr-4" />
                  Descargar
                </Button>
              </Toolbar>
            </div>
          </Row>
          <DataTableBase columns={NdfColumns} data={copndfGrid} fixedHeader />
        </>
      );
    }

    // ── Tab: FXEmpire ──
    if (activeTab === 'fxe') {
      if (fxeData.length === 0) {
        return (
          <Row className="mt-3">
            <Col>
              <div style={{ color: '#999', padding: 40, textAlign: 'center' }}>
                No hay datos de FXEmpire disponibles
              </div>
            </Col>
          </Row>
        );
      }

      return (
        <Row className="mt-3">
          <Col>
            <h6 style={{ marginBottom: 12 }}>
              Forward Rates — FXEmpire ({fxeData[0]?.fecha})
            </h6>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
              >
                <thead>
                  <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tenor</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Bid</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ask</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#1f77b4', fontWeight: 700 }}>Mid</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Fwd Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[...fxeData]
                    .sort((a, b) => a.tenor_months - b.tenor_months)
                    .map((row) => (
                      <tr key={row.tenor} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{row.tenor}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          {row.bid?.toFixed(2) ?? '—'}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          {row.ask?.toFixed(2) ?? '—'}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#1f77b4', fontWeight: 600 }}>
                          {row.mid?.toFixed(2) ?? '—'}
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          {row.fwd_points?.toFixed(2) ?? '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Col>
        </Row>
      );
    }

    return null;
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faLandmark} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-between pb-3">
            <Tabs outlined>
              {pageTabs.map(({ active, name, property, icon }) => (
                <Tab
                  active={active}
                  key={name}
                  onClick={() => handleTabChange(property)}
                >
                  {icon && <Icon icon={icon} />}
                  {name}
                </Tab>
              ))}
            </Tabs>
          </div>
        </Row>
        {renderContent()}
      </Container>
    </CoreLayout>
  );
}

export default NdfCopViewer;
