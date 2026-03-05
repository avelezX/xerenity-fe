'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, DropdownDivider } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Container from 'react-bootstrap/Container';
import { LightSerieValue } from 'src/types/lightserie';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faAreaChart,
  faBarChart,
  faFileCsv,
  faLineChart,
  faCaretRight,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import {
  TesYields,
  CandleSerie,
  GridEntry,
  TesEntryToArray,
} from 'src/types/tes';
import CandleGridViewer from '@components/grid/CandleGrid';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import { Tab, Tabs, TabItemType } from '@components/UI/Tabs';
import PageTitle from '@components/PageTitle';
import { SelectableRows } from 'src/types/selectableRows';
import YieldCurveChart from '@components/yieldCurve/YieldCurveChart';
import CombinedYieldCurveChart from '@components/yieldCurve/CombinedYieldCurveChart';
import RatePathChart from '@components/yieldCurve/RatePathChart';
import { bootstrapRatePath } from 'src/utils/ratePathBootstrap';
import { BANREP_MEETINGS } from 'src/utils/centralBankMeetings';
import styles from './tes.module.css';

const TAB_ITEMS: TabItemType[] = [
  {
    name: 'Coltes/COP',
    property: 'COLTES-COP',
    icon: faLineChart,
    active: true,
  },
  {
    name: 'Coltes/UVR',
    property: 'COLTES-UVR',
    icon: faBarChart,
    active: false,
  },
  {
    name: 'Swaps/IBR',
    property: 'COLTES-IBR',
    icon: faAreaChart,
    active: false,
  },
];

const designSystem = tokens.xerenity;
const PURPLE_COLOR = designSystem['purple-100'].value;
const GRAY_COLOR_300 = designSystem['gray-300'].value;
const OPCIONES = 'Opciones';
const MONTH_OPTIONS = [20, 30, 50];
const DEFAULT_IBR_NAME = 'IBR_2Y';

function isExpired(displayname: string): boolean {
  const parts = displayname.trim().split(' ');
  const dateStr = parts[parts.length - 1];
  if (!dateStr || !dateStr.includes('/')) return false;
  const segments = dateStr.split('/');
  if (segments.length !== 3) return false;
  const [mm, dd, yy] = segments;
  const year = 2000 + parseInt(yy, 10);
  if (Number.isNaN(year)) return false;
  const maturity = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10));
  return maturity < new Date();
}

function formatKpiVolume(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString('es-CO');
}

export default function FullTesViewer() {
  const supabase = createClientComponentClient();
  const [options, setOptions] = useState<GridEntry[]>([]);
  const [filterExpired, setFilterExpired] = useState(true);
  const [filterTradedToday, setFilterTradedToday] = useState(true);
  const [showCurveToday, setShowCurveToday] = useState(true);
  const [filterSendaToday, setFilterSendaToday] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<GridEntry | null>(null);
  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });
  const ibrAllData = useRef<Map<string, GridEntry>>();
  const serieId = useRef<string>('tes_24');
  const [movingAvgDays, setMovingAvgDays] = useState<number>(20);
  const [smaEnabled, setSmaEnabled] = useState(false);
  const displayName = useRef<string>('');
  const [currencyType, setCurrencyType] = useState(TAB_ITEMS[0].property);
  const [volumenSerie, setvolumenSerie] = useState<LightSerieValue[]>([]);
  const [pageTabs, setTabsState] = useState<TabItemType[]>(TAB_ITEMS);
  const [viewMode, setViewMode] = useState<'candle' | 'curve' | 'todas' | 'senda'>('candle');
  const [ibrGridData, setIbrGridData] = useState<GridEntry[]>([]);
  const [allCurvesData, setAllCurvesData] = useState<{
    cop: GridEntry[];
    uvr: GridEntry[];
    ibr: GridEntry[];
  }>({ cop: [], uvr: [], ibr: [] });

  // Derived: hide expired bonds when checkbox is on (IBR has no maturity dates)
  const filteredOptions = useMemo(() => {
    if (currencyType === 'COLTES-IBR') {
      if (!filterTradedToday || options.length === 0) return options;
      const latestDate = options
        .reduce((max, e) => (e.operation_time > max ? e.operation_time : max), options[0].operation_time)
        .split('T')[0];
      return options.filter((e) => e.operation_time.split('T')[0] === latestDate);
    }
    if (!filterExpired) return options;
    return options.filter((e) => !isExpired(e.displayname));
  }, [options, filterExpired, filterTradedToday, currencyType]);

  // KPI computations
  const kpis = useMemo(() => {
    const total = filteredOptions.reduce((s, e) => s + e.volume, 0);
    const weightedBps = filteredOptions.reduce(
      (s, e) => s + (e.close - e.prev) * 100 * e.volume,
      0
    );
    const avgBps = total > 0 ? weightedBps / total : 0;
    return {
      totalVolume: total,
      avgBps,
      activeYield: selectedEntry?.close ?? null,
      activeName: selectedEntry?.displayname ?? '',
      count: filteredOptions.length,
    };
  }, [filteredOptions, selectedEntry]);

  const fetchTesRawData = useCallback(
    async (view_tes: string) => {
      const { data, error } = await supabase
        .schema('xerenity')
        .from(view_tes)
        .select()
        .order('day', { ascending: true });

      if (error) {
        setCandleSerie({ name: '', values: [] });
      } else if (data) {
        const allData = data as TesYields[];
        const volData: { time: string; value: number }[] = [];
        allData.forEach((tes) => {
          volData.push({ time: tes.day.split('T')[0], value: tes.volume });
        });
        setvolumenSerie(volData);
        setCandleSerie({ name: '', values: allData });
      } else {
        setCandleSerie({ name: '', values: [] });
      }
    },
    [supabase]
  );

  // Local SMA: calculated from candle data already in memory — no extra network call
  const movingAvgSerie = useMemo<LightSerieValue[] | null>(() => {
    if (!smaEnabled || candleSerie.values.length < movingAvgDays) return null;
    const vals = candleSerie.values;
    const result: LightSerieValue[] = [];
    for (let i = movingAvgDays - 1; i < vals.length; i += 1) {
      const avg =
        vals.slice(i - movingAvgDays + 1, i + 1).reduce((s, v) => s + v.close, 0) /
        movingAvgDays;
      result.push({ time: vals[i].day.split('T')[0], value: avg });
    }
    return result;
  }, [smaEnabled, candleSerie.values, movingAvgDays]);

  const changeSelection = useCallback(
    async (id: string, placeholder: string) => {
      serieId.current = id;
      displayName.current = placeholder;
      fetchTesRawData(serieId.current);
    },
    [fetchTesRawData]
  );

  const fetchTesNames = useCallback(async () => {
    if (currencyType === 'COLTES-COP' || currencyType === 'COLTES-UVR') {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('get_tes_grid_raw', { money: currencyType });

      if (error) setOptions([]);

      if (data) {
        const allData = data as GridEntry[];

        // Select highest-volume non-expired bond as default
        const activeData = allData.filter((e) => !isExpired(e.displayname));
        const pool = activeData.length > 0 ? activeData : allData;
        const defEntry = [...pool].sort((a, b) => b.volume - a.volume)[0];

        if (defEntry) {
          setSelectedEntry(defEntry);
          changeSelection(defEntry.tes, defEntry.displayname);
        }
        setOptions(allData);
      } else {
        setOptions([]);
      }
    } else {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('get_ibr_grid_raw', {});

      if (error) {
        setOptions([]);
        toast.error(error.message);
      }

      if (data) {
        const allIbr = data as GridEntry[];
        const mapping = new Map<string, GridEntry>();
        if (allIbr.length > 0) {
          allIbr.forEach((entry) => mapping.set(entry.tes, entry));

          const defIbr = allIbr.find((e) => e.displayname === DEFAULT_IBR_NAME);
          if (defIbr) {
            setSelectedEntry(defIbr);
            changeSelection(defIbr.tes, defIbr.displayname);
          }
        } else {
          setOptions([]);
        }
        ibrAllData.current = mapping;
        setOptions(allIbr);
      } else {
        setOptions([]);
      }
    }
  }, [currencyType, supabase, changeSelection]);

  const fetchAllCurves = useCallback(async () => {
    const [copRes, uvrRes, ibrRes] = await Promise.all([
      supabase.schema('xerenity').rpc('get_tes_grid_raw', { money: 'COLTES-COP' }),
      supabase.schema('xerenity').rpc('get_tes_grid_raw', { money: 'COLTES-UVR' }),
      supabase.schema('xerenity').rpc('get_ibr_grid_raw', {}),
    ]);
    setAllCurvesData({
      cop: (copRes.data as GridEntry[]) || [],
      uvr: (uvrRes.data as GridEntry[]) || [],
      ibr: (ibrRes.data as GridEntry[]) || [],
    });
  }, [supabase]);

  useEffect(() => {
    fetchTesNames();
  }, [fetchTesNames]);

  const fetchIbrGrid = useCallback(async () => {
    const { data, error } = await supabase.schema('xerenity').rpc('get_ibr_grid_raw', {});
    if (!error && data) setIbrGridData(data as GridEntry[]);
  }, [supabase]);

  useEffect(() => {
    if (viewMode === 'todas') fetchAllCurves();
    if (viewMode === 'senda') fetchIbrGrid();
  }, [viewMode, fetchAllCurves, fetchIbrGrid]);

  const copRatePathData = useMemo(() => {
    if (ibrGridData.length === 0) return { path: [], currentRate: 0, curveDate: '' };
    const latestOp = ibrGridData.reduce(
      (max, e) => (e.operation_time > max ? e.operation_time : max),
      ibrGridData[0].operation_time
    );
    const curveDate = latestOp.split('T')[0];
    const curve = ibrGridData
      .filter((e) => {
        if (e.close <= 0 || e.tes_months <= 0) return false;
        if (filterSendaToday) return e.operation_time.split('T')[0] === curveDate;
        const cutoff = new Date(curveDate);
        cutoff.setDate(cutoff.getDate() - 5);
        return e.operation_time >= cutoff.toISOString().split('T')[0];
      })
      .map((e) => ({ tenor_months: e.tes_months, rate: e.close }))
      .sort((a, b) => a.tenor_months - b.tenor_months);
    if (curve.length < 2) return { path: [], currentRate: 0, curveDate: '' };
    const threeMonth = curve.find((c) => c.tenor_months === 3);
    const currentRate = threeMonth ? threeMonth.rate : curve[0].rate;
    const path = bootstrapRatePath(curve, currentRate, BANREP_MEETINGS, curveDate);
    return { path, currentRate, curveDate };
  }, [ibrGridData, filterSendaToday]);

  const handleSelect = ({ selectedRows }: SelectableRows<GridEntry>) => {
    if (selectedRows.length > 0) {
      const entry: GridEntry = selectedRows[0];
      setSelectedEntry(entry);
      changeSelection(entry.tes, entry.displayname);
    }
  };

  const handleCurrencyChange = (tabProp: string) => {
    setCurrencyType(tabProp);
    setSelectedEntry(null);
    setTabsState((prevState) =>
      prevState.map((tab) => ({ ...tab, active: tab.property === tabProp }))
    );
  };

  const handleMonthChange = (month: number) => {
    setMovingAvgDays(month);
    setSmaEnabled(true);
  };

  const downloadGrid = () => {
    const allValues: string[][] = [];
    allValues.push(['open', 'high', 'low', 'close', 'volume', 'day']);
    candleSerie.values.forEach((entry) => allValues.push(TesEntryToArray(entry)));
    const csv = ExportToCsv(allValues);
    downloadBlob(csv, `xerenity_${displayName}.csv`, 'text/csv;charset=utf-8;');
  };

  const bpsSign = kpis.avgBps > 0 ? '+' : '';
  let bpsArrow = '—';
  if (kpis.avgBps > 0) bpsArrow = '▲';
  else if (kpis.avgBps < 0) bpsArrow = '▼';

  let bpsClassName = styles.kpiValueNeutral;
  if (kpis.avgBps > 0) bpsClassName = styles.kpiValueDanger;
  else if (kpis.avgBps < 0) bpsClassName = styles.kpiValueSuccess;

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faLineChart} size="1x" />
              <h4>Tasas COP</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-between pb-3">
            <div className="d-flex gap-2">
              <Tabs outlined>
                {pageTabs.map(({ active, name, property, icon }) => (
                  <Tab
                    active={active}
                    key={name}
                    onClick={() => handleCurrencyChange(property)}
                  >
                    {icon && <Icon icon={icon} />}
                    {name}
                  </Tab>
                ))}
              </Tabs>
              <Tabs outlined>
                <Tab active={viewMode === 'candle'} onClick={() => setViewMode('candle')}>
                  <Icon icon={faBarChart} />
                  Candlestick
                </Tab>
                <Tab active={viewMode === 'curve'} onClick={() => setViewMode('curve')}>
                  <Icon icon={faLineChart} />
                  Curva
                </Tab>
                <Tab active={viewMode === 'todas'} onClick={() => setViewMode('todas')}>
                  <Icon icon={faLineChart} />
                  Todas
                </Tab>
                <Tab active={viewMode === 'senda'} onClick={() => setViewMode('senda')}>
                  <Icon icon={faLineChart} />
                  Senda
                </Tab>
              </Tabs>
            </div>
            <Toolbar>
              <Dropdown>
                <Dropdown.Toggle>{OPCIONES}</Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={downloadGrid}>
                    <div className="d-flex gap-2 align-items-center">
                      <Icon icon={faFileCsv} />
                      <span>Descargar</span>
                    </div>
                  </Dropdown.Item>
                  <DropdownDivider />
                  {MONTH_OPTIONS.map((month) => (
                    <Dropdown.Item key={month} onClick={() => handleMonthChange(month)}>
                      <div className="d-flex gap-2 align-items-center">
                        <Icon icon={faCaretRight} />
                        <span>{`Promedio Movil ${month}`}</span>
                      </div>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Toolbar>
          </div>
        </Row>

        {/* KPI Summary Bar */}
        <Row className="mb-3">
          <Col>
            <div className={styles.kpiBar}>
              <div className={styles.kpiBox}>
                <span className={styles.kpiLabel}>VOLUMEN TOTAL</span>
                <span className={styles.kpiValueNeutral}>
                  {formatKpiVolume(kpis.totalVolume)}
                </span>
                <span className={styles.kpiSub}>COP en el día</span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiLabel}>CAMBIO PROM.</span>
                <span className={bpsClassName}>
                  {bpsArrow} {bpsSign}{kpis.avgBps.toFixed(1)} bps
                </span>
                <span className={styles.kpiSub}>pond. por volumen</span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiLabel}>YIELD ACTIVO</span>
                <span className={styles.kpiValuePurple}>
                  {kpis.activeYield !== null ? `${kpis.activeYield.toFixed(2)}%` : '—'}
                </span>
                <span className={styles.kpiSub}>
                  {kpis.activeName
                    ? kpis.activeName.split(' ').slice(0, 3).join(' ')
                    : 'selecciona un bono'}
                </span>
              </div>
              <div className={styles.kpiBox}>
                <span className={styles.kpiLabel}>TÍTULOS</span>
                <span className={styles.kpiValueNeutral}>{kpis.count}</span>
                <span className={styles.kpiSub}>en pantalla</span>
              </div>
            </div>
          </Col>
        </Row>

        <Row>
          <Col>
            {viewMode === 'candle' && (
                <Chart
                  chartHeight={500}
                  showToolbar
                  header={selectedEntry && (
                    <div className={styles.chartTitle}>
                      {selectedEntry.displayname}
                      <span className={styles.chartTitleYield}>
                        {selectedEntry.close.toFixed(2)}%
                      </span>
                    </div>
                  )}
                >
                  <Chart.Candle data={candleSerie.values} scaleId="right" />
                  <Chart.Volume
                    data={volumenSerie}
                    scaleId="left"
                    title="Volumen"
                    color={GRAY_COLOR_300}
                  />
                  {movingAvgSerie ? (
                    <Chart.Line
                      data={movingAvgSerie}
                      color={PURPLE_COLOR}
                      scaleId="right"
                      title={`SMA ${movingAvgDays}`}
                    />
                  ) : null}
                </Chart>
            )}

            {viewMode === 'todas' && (
              <CombinedYieldCurveChart
                copData={allCurvesData.cop}
                uvrData={allCurvesData.uvr}
                ibrData={allCurvesData.ibr}
              />
            )}
            {viewMode === 'curve' && (
              <YieldCurveChart data={options} curveType={currencyType} showTodayOnly={showCurveToday} />
            )}
            {viewMode === 'senda' && (
              <>
                <div className={styles.filterRowSenda}>
                  <label className={styles.filterLabel}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={filterSendaToday}
                      onChange={(e) => setFilterSendaToday(e.target.checked)}
                    />
                    Solo hoy (curva OIS)
                  </label>
                </div>
                <RatePathChart
                  data={copRatePathData.path}
                  currentRate={copRatePathData.currentRate}
                  curveDate={copRatePathData.curveDate}
                  color="#6366F1"
                  title="Senda Implícita BanRep (IBR 3M OIS)"
                />
              </>
            )}
          </Col>
        </Row>

        {viewMode !== 'senda' && (
          <Row className="mt-2">
            <Col>
              <div className={styles.filterRow}>
                {currencyType !== 'COLTES-IBR' && (
                  <label className={styles.filterLabel}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={filterExpired}
                      onChange={(e) => setFilterExpired(e.target.checked)}
                    />
                    Solo vigentes
                  </label>
                )}
                {currencyType === 'COLTES-IBR' && viewMode !== 'curve' && (
                  <label className={styles.filterLabel}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={filterTradedToday}
                      onChange={(e) => setFilterTradedToday(e.target.checked)}
                    />
                    Solo operados hoy
                  </label>
                )}
                {currencyType === 'COLTES-IBR' && viewMode === 'curve' && (
                  <label className={styles.filterLabel}>
                    <input
                      type="checkbox"
                      className={styles.filterCheckbox}
                      checked={showCurveToday}
                      onChange={(e) => setShowCurveToday(e.target.checked)}
                    />
                    Solo hoy (curva)
                  </label>
                )}
                {options.length > filteredOptions.length && (
                  <span className={styles.filterHidden}>
                    ({options.length - filteredOptions.length} oculto
                    {options.length - filteredOptions.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <CandleGridViewer onSelect={handleSelect} allTes={filteredOptions} />
            </Col>
          </Row>
        )}
      </Container>
    </CoreLayout>
  );
}

