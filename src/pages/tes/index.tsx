'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, DropdownDivider } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import {
  LightSerie,
  LightSerieValue,
  defaultCustomFormat,
} from 'src/types/lightserie';
import { MovingAvgValue } from 'src/types/movingAvg';
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
import { TableSelectedRows } from '@components/Table/models';

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

export default function FullTesViewer() {
  const supabase = createClientComponentClient();
  const [options, setOptions] = useState<GridEntry[]>([]);
  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });
  const ibrAllData = useRef<Map<string, GridEntry>>();
  const serieId = useRef<string>('tes_24');
  const movingAvgDays = useRef<number>(20);
  const displayName = useRef<string>('');
  const [currencyType, setCurrencyType] = useState(TAB_ITEMS[0].property);
  const [movingAvg, setMovingAvg] = useState<LightSerie>();
  const [volumenSerie, setvolumenSerie] = useState<LightSerieValue[]>([]);
  const [pageTabs, setTabsState] = useState<TabItemType[]>(TAB_ITEMS);

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

  const fetchTesMvingAvgIbr = useCallback(
    async (
      selected_name: string,
      moving_days: number,
      display_name: string
    ) => {
      if (ibrAllData.current) {
        const ibrIdentifier = ibrAllData.current.get(selected_name)?.tes_months;

        if (ibrIdentifier) {
          const { data, error } = await supabase
            .schema('xerenity')
            .rpc('ibr_moving_average', {
              ibr_months: ibrIdentifier,
              average_days: moving_days,
            });

          if (error) {
            toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
          } else if (data) {
            const avgValues = data.moving_avg as MovingAvgValue[];
            const avgSerie = Array<LightSerieValue>();
            avgValues.forEach((avgval) => {
              avgSerie.push({
                value: avgval.avg,
                time: avgval.close_date.split('T')[0],
              });
            });
            setMovingAvg({
              serie: avgSerie,
              color: PURPLE_COLOR,
              name: display_name,
              type: 'line',
              priceFormat: defaultCustomFormat,
              axisName: 'right',
            });
          }
        }
      }
    },
    [supabase]
  );

  const fetchTesMvingAvg = useCallback(
    async (
      selected_name: string,
      moving_days: number,
      display_name: string
    ) => {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('tes_moving_average', {
          tes_name: selected_name,
          average_days: moving_days,
        });

      if (error) {
        toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
      } else if (data) {
        const avgValues = data.moving_avg as MovingAvgValue[];
        const avgSerie = Array<LightSerieValue>();
        avgValues.forEach((avgval) => {
          avgSerie.push({
            value: avgval.avg,
            time: avgval.close_date.split('T')[0],
          });
        });
        setMovingAvg({
          serie: avgSerie,
          color: PURPLE_COLOR,
          name: display_name,
          type: 'line',
          priceFormat: defaultCustomFormat,
          axisName: 'right',
        });
      }
    },
    [supabase, setMovingAvg]
  );

  const changeSelection = useCallback(
    async (id: string, placeholder: string) => {
      serieId.current = id;
      displayName.current = placeholder;

      fetchTesRawData(serieId.current);

      if (id.includes('ibr')) {
        fetchTesMvingAvgIbr(
          serieId.current,
          movingAvgDays.current,
          placeholder
        );
      } else {
        fetchTesMvingAvg(serieId.current, movingAvgDays.current, placeholder);
      }
    },
    [fetchTesMvingAvg, fetchTesMvingAvgIbr, fetchTesRawData, movingAvgDays]
  );

  const fetchTesNames = useCallback(async () => {
    if (currencyType === 'COLTES-COP' || currencyType === 'COLTES-UVR') {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('get_tes_grid_raw', { money: currencyType });

      if (error) {
        setOptions([]);
      }

      if (data) {
        const allData = data as GridEntry[];

        if (allData.length > 0) {
          changeSelection(allData[0].tes, allData[0].displayname);
        }
        setOptions(allData);
      } else {
        setOptions([] as GridEntry[]);
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
          allIbr.forEach((entry) => {
            mapping.set(entry.tes, entry);
          });

          changeSelection(allIbr[0].tes, allIbr[0].displayname);
        } else {
          setOptions([]);
        }

        ibrAllData.current = mapping;

        setOptions(allIbr);
      } else {
        setOptions([] as GridEntry[]);
      }
    }
  }, [currencyType, supabase, changeSelection]);

  useEffect(() => {
    fetchTesNames();
  }, [fetchTesNames]);

  const handleSelect = ({ selectedRows }: TableSelectedRows<GridEntry>) => {
    if (selectedRows.length > 0) {
      const entry: GridEntry = selectedRows[0];
      changeSelection(entry.tes, entry.displayname);
    }
  };

  const handleCurrencyChange = (tabProp: string) => {
    setCurrencyType(tabProp);
    setTabsState((prevState) =>
      prevState.map((tab) => ({
        ...tab,
        active: tab.property === tabProp,
      }))
    );
  };

  const handleMonthChange = (month: number) => {
    movingAvgDays.current = month;
    if (serieId.current.includes('ibr')) {
      return fetchTesMvingAvgIbr(serieId.current, month, displayName.current);
    }
    return fetchTesMvingAvg(serieId.current, month, displayName.current);
  };

  const downloadGrid = () => {
    const allValues: string[][] = [];
    allValues.push(['open', 'high', 'low', 'close', 'volume', 'day']);
    candleSerie.values.forEach((entry) => {
      allValues.push(TesEntryToArray(entry));
    });

    const csv = ExportToCsv(allValues);
    downloadBlob(csv, `xerenity_${displayName}.csv`, 'text/csv;charset=utf-8;');
  };

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
                    <Dropdown.Item
                      key={month}
                      onClick={() => handleMonthChange(month)}
                    >
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
        <Row>
          <Col>
            <Chart chartHeight={800}>
              <Chart.Candle data={candleSerie.values} scaleId="right" />
              <Chart.Volume
                data={volumenSerie}
                scaleId="left"
                title="Volumen"
                color={GRAY_COLOR_300}
              />
              {movingAvg ? (
                <Chart.Line
                  data={movingAvg.serie}
                  color={PURPLE_COLOR}
                  scaleId="right"
                  title={movingAvg.name}
                />
              ) : null}
            </Chart>
          </Col>
        </Row>
        <Row>
          <Col>
            <CandleGridViewer onSelect={handleSelect} allTes={options} />
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
