'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col } from 'react-bootstrap';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Container from 'react-bootstrap/Container';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faLineChart,
  faBarChart,
  faAreaChart,
} from '@fortawesome/free-solid-svg-icons';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import PageTitle from '@components/PageTitle';
import USTYieldCurveChart from '@components/yieldCurve/USTYieldCurveChart';
import SOFRSwapCurveChart from '@components/yieldCurve/SOFRSwapCurveChart';
import CombinedUSDYieldCurveChart from '@components/yieldCurve/CombinedUSDYieldCurveChart';
import RatePathChart from '@components/yieldCurve/RatePathChart';
import {
  USTYieldPoint,
  USReferenceRate,
  SOFRSwapPoint,
} from 'src/types/usrates';
import { bootstrapRatePath } from 'src/utils/ratePathBootstrap';
import { FOMC_MEETINGS } from 'src/utils/centralBankMeetings';

const TAB_ITEMS: TabItemType[] = [
  {
    name: 'SOFR Swaps',
    property: 'sofr',
    icon: faLineChart,
    active: true,
  },
  {
    name: 'UST Curves',
    property: 'curves',
    icon: faAreaChart,
    active: false,
  },
  {
    name: 'Todas',
    property: 'todas',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'Rate Path',
    property: 'ratepath',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'EFFR & OBFR',
    property: 'rates',
    icon: faBarChart,
    active: false,
  },
];

const UST_TENOR_LABELS: Record<number, string> = {
  1: '1M',
  2: '2M',
  3: '3M',
  4: '4M',
  6: '6M',
  12: '1Y',
  24: '2Y',
  36: '3Y',
  60: '5Y',
  84: '7Y',
  120: '10Y',
  240: '20Y',
  360: '30Y',
};

const SOFR_TENOR_LABELS: Record<number, string> = {
  1: '1M',
  3: '3M',
  6: '6M',
  9: '9M',
  12: '1Y',
  18: '18M',
  24: '2Y',
  36: '3Y',
  48: '4Y',
  60: '5Y',
  72: '6Y',
  84: '7Y',
  96: '8Y',
  108: '9Y',
  120: '10Y',
  144: '12Y',
  180: '15Y',
  240: '20Y',
  300: '25Y',
  360: '30Y',
  480: '40Y',
  600: '50Y',
};

function RateCard({
  label,
  rate,
}: {
  label: string;
  rate: USReferenceRate | undefined;
}) {
  if (!rate) return null;
  const displayRate = rate.rate_type.includes('AVG')
    ? `${rate.rate.toFixed(5)}%`
    : `${rate.rate.toFixed(2)}%`;
  return (
    <div
      style={{
        border: '1px solid #dee2e6',
        borderRadius: 8,
        padding: '16px 20px',
        backgroundColor: '#fafafa',
      }}
    >
      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{displayRate}</div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
        {rate.fecha}
        {rate.volume_billions != null && ` | Vol: $${rate.volume_billions}B`}
      </div>
      {rate.target_from != null && rate.target_to != null && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
          Fed target: {rate.target_from}% - {rate.target_to}%
        </div>
      )}
    </div>
  );
}

function USTCurveTableRow({
  tenor,
  nom,
  tip,
}: {
  tenor: number;
  nom: number | undefined;
  tip: number | undefined;
}) {
  const be = nom != null && tip != null ? nom - tip : null;
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '6px 12px', fontWeight: 600 }}>
        {UST_TENOR_LABELS[tenor] ?? `${tenor}M`}
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {nom != null ? `${nom.toFixed(2)}%` : '-'}
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {tip != null ? `${tip.toFixed(2)}%` : '-'}
      </td>
      <td
        style={{
          padding: '6px 12px',
          textAlign: 'right',
          color: '#e377c2',
          fontWeight: 600,
        }}
      >
        {be != null ? `${be.toFixed(2)}%` : '-'}
      </td>
    </tr>
  );
}

function SOFRTableRow({
  tenorMonths,
  rate,
}: {
  tenorMonths: number;
  rate: number;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '6px 12px', fontWeight: 600 }}>
        {SOFR_TENOR_LABELS[tenorMonths] ?? `${tenorMonths}M`}
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {rate.toFixed(4)}%
      </td>
    </tr>
  );
}

function HistoricalRateRow({
  fecha,
  rates,
}: {
  fecha: string;
  rates: Record<string, number>;
}) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '6px 12px' }}>{fecha}</td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {rates.SOFR != null ? `${rates.SOFR.toFixed(2)}%` : '-'}
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {rates.EFFR != null ? `${rates.EFFR.toFixed(2)}%` : '-'}
      </td>
      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
        {rates.OBFR != null ? `${rates.OBFR.toFixed(2)}%` : '-'}
      </td>
    </tr>
  );
}

export default function USRatesPage() {
  const supabase = createClientComponentClient();
  const [activeTab, setActiveTab] = useState('sofr');
  const [pageTabs, setPageTabs] = useState<TabItemType[]>(TAB_ITEMS);
  const [sofrData, setSofrData] = useState<SOFRSwapPoint[]>([]);
  const [yieldData, setYieldData] = useState<USTYieldPoint[]>([]);
  const [ratesData, setRatesData] = useState<USReferenceRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSOFRCurve = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('sofr_swap_curve')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(44);

    if (!error && data) {
      setSofrData(data as SOFRSwapPoint[]);
    }
  }, [supabase]);

  const fetchYieldCurve = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('ust_yield_curve')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(18);

    if (!error && data) {
      setYieldData(data as USTYieldPoint[]);
    }
  }, [supabase]);

  const fetchRates = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('us_reference_rates')
      .select('*')
      .in('rate_type', [
        'SOFR',
        'EFFR',
        'OBFR',
        'SOFR_AVG_30D',
        'SOFR_AVG_90D',
        'SOFR_AVG_180D',
      ])
      .order('fecha', { ascending: false })
      .limit(180);

    if (!error && data) {
      setRatesData(data as USReferenceRate[]);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'sofr') {
      fetchSOFRCurve().then(() => setLoading(false));
    } else if (activeTab === 'curves') {
      fetchYieldCurve().then(() => setLoading(false));
    } else if (activeTab === 'todas') {
      Promise.all([fetchSOFRCurve(), fetchYieldCurve()]).then(() =>
        setLoading(false)
      );
    } else if (activeTab === 'ratepath') {
      Promise.all([fetchSOFRCurve(), fetchRates()]).then(() =>
        setLoading(false)
      );
    } else {
      fetchRates().then(() => setLoading(false));
    }
  }, [activeTab, fetchSOFRCurve, fetchYieldCurve, fetchRates]);

  const handleTabChange = (tabProp: string) => {
    setActiveTab(tabProp);
    setPageTabs((prev) =>
      prev.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const sofrTableRows = useMemo(() => {
    if (sofrData.length === 0) return [];
    const latestDate = sofrData.reduce(
      (max, d) => (d.fecha > max ? d.fecha : max),
      sofrData[0].fecha
    );
    return sofrData
      .filter((d) => d.fecha === latestDate)
      .sort((a, b) => a.tenor_months - b.tenor_months);
  }, [sofrData]);

  const latestRates = useMemo(() => {
    const map = new Map<string, USReferenceRate>();
    ratesData.forEach((r) => {
      if (!map.has(r.rate_type)) map.set(r.rate_type, r);
    });
    return map;
  }, [ratesData]);

  const latestCurve = useMemo(() => {
    if (yieldData.length === 0) return [];
    const latestDate = yieldData[0].fecha;
    return yieldData
      .filter((d) => d.fecha === latestDate)
      .sort((a, b) => a.tenor_months - b.tenor_months);
  }, [yieldData]);

  const curveTableRows = useMemo(() => {
    const nomMap = new Map<number, number>();
    const tipMap = new Map<number, number>();
    latestCurve.forEach((pt) => {
      if (pt.curve_type === 'NOMINAL')
        nomMap.set(pt.tenor_months, pt.yield_value);
      else tipMap.set(pt.tenor_months, pt.yield_value);
    });
    const allTenors = Array.from(
      new Set([...Array.from(nomMap.keys()), ...Array.from(tipMap.keys())])
    ).sort((a, b) => a - b);
    return allTenors.map((t) => ({
      tenor: t,
      nom: nomMap.get(t),
      tip: tipMap.get(t),
    }));
  }, [latestCurve]);

  const historicalRows = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    ratesData
      .filter((r) => ['SOFR', 'EFFR', 'OBFR'].includes(r.rate_type))
      .forEach((r) => {
        if (!dateMap.has(r.fecha)) dateMap.set(r.fecha, {});
        const entry = dateMap.get(r.fecha);
        if (entry) entry[r.rate_type] = r.rate;
      });
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30);
  }, [ratesData]);

  const ratePathData = useMemo(() => {
    if (sofrData.length === 0) return { path: [], currentRate: 0, curveDate: '' };
    const latestDate = sofrData.reduce(
      (max, d) => (d.fecha > max ? d.fecha : max),
      sofrData[0].fecha
    );
    const curve = sofrData
      .filter((d) => d.fecha === latestDate)
      .map((d) => ({ tenor_months: d.tenor_months, rate: d.swap_rate }))
      .sort((a, b) => a.tenor_months - b.tenor_months);

    // Use latest SOFR overnight rate if available, else use shortest swap tenor
    const sofrRate = latestRates.get('SOFR');
    let currentRate = 0;
    if (sofrRate) {
      currentRate = sofrRate.rate;
    } else if (curve.length > 0) {
      currentRate = curve[0].rate;
    }

    const path = bootstrapRatePath(curve, currentRate, FOMC_MEETINGS, latestDate);
    return { path, currentRate, curveDate: latestDate };
  }, [sofrData, latestRates]);

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

    if (activeTab === 'sofr') {
      return (
        <>
          <Row>
            <Col>
              <SOFRSwapCurveChart data={sofrData} />
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                        Tenor
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                        SOFR Swap Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sofrTableRows.map((pt) => (
                      <SOFRTableRow
                        key={pt.tenor_months}
                        tenorMonths={pt.tenor_months}
                        rate={pt.swap_rate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Col>
          </Row>
        </>
      );
    }

    if (activeTab === 'ratepath') {
      return (
        <Row>
          <Col>
            <RatePathChart
              data={ratePathData.path}
              currentRate={ratePathData.currentRate}
              curveDate={ratePathData.curveDate}
              color="#ff7f0e"
              title="Fed Implied Rate Path (SOFR Overnight OIS)"
            />
          </Col>
        </Row>
      );
    }

    if (activeTab === 'todas') {
      return (
        <Row>
          <Col>
            <CombinedUSDYieldCurveChart
              sofrData={sofrData}
              ustData={yieldData}
            />
          </Col>
        </Row>
      );
    }

    if (activeTab === 'curves') {
      return (
        <>
          <Row>
            <Col>
              <USTYieldCurveChart data={yieldData} />
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                        Tenor
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                        Nominal
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                        TIPS
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                        Breakeven
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {curveTableRows.map(({ tenor, nom, tip }) => (
                      <USTCurveTableRow
                        key={tenor}
                        tenor={tenor}
                        nom={nom}
                        tip={tip}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Col>
          </Row>
        </>
      );
    }

    return (
      <Row>
        <Col>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <RateCard label="SOFR (Overnight)" rate={latestRates.get('SOFR')} />
            <RateCard label="EFFR" rate={latestRates.get('EFFR')} />
            <RateCard label="OBFR" rate={latestRates.get('OBFR')} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <RateCard
              label="SOFR 30 Day Avg"
              rate={latestRates.get('SOFR_AVG_30D')}
            />
            <RateCard
              label="SOFR 90 Day Avg"
              rate={latestRates.get('SOFR_AVG_90D')}
            />
            <RateCard
              label="SOFR 180 Day Avg"
              rate={latestRates.get('SOFR_AVG_180D')}
            />
          </div>

          <h6 style={{ marginTop: 16, marginBottom: 12 }}>
            Historical Rates (last 30 days)
          </h6>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                    Date
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                    SOFR
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                    EFFR
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                    OBFR
                  </th>
                </tr>
              </thead>
              <tbody>
                {historicalRows.map(([fecha, rates]) => (
                  <HistoricalRateRow
                    key={fecha}
                    fecha={fecha}
                    rates={rates}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Col>
      </Row>
    );
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faAreaChart} size="1x" />
              <h4>Tasas USD</h4>
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
