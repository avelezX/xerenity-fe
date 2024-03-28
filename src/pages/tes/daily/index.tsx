'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, DropdownDivider } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import Container from 'react-bootstrap/Container';
import {
  LightSerie,
  LightSerieValue,
  defaultCustomFormat,
} from '@models/lightserie';
import { MovingAvgValue } from '@models/movingAvg';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import {
  faAreaChart,
  faBarChart,
  faFileCsv,
  faLineChart,
  faLongArrowAltRight,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import ToolbarItem from '@components/UI/Toolbar/ToolbarItem';
import {
  TesYields,
  CandleSerie,
  GridEntry,
  TesEntryToArray,
} from '@models/tes';
import CandleGridViewer from '@components/grid/CandleGrid';
import CandleSerieViewer from '@components/compare/candleViewer';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';

const TOOLBAR_ITEMS = [
  {
    name: 'Coltes/COP',
    property: 'COLTES-COP',
    icon: faLineChart,
  },
  {
    name: 'Coltes/UVR',
    property: 'COLTES-UVR',
    icon: faBarChart,
  },
  {
    name: 'Coltes/IBR',
    property: 'COLTES-IBR',
    icon: faAreaChart,
  },
];

const designSystem = tokens.xerenity;
const PURPLE_COLOR = designSystem['purple-100'].value;

const OPCIONES = 'Opciones';

const MONTH_OPTIONS = [20, 30, 50];

export default function FullTesViewer() {
  const supabase = createClientComponentClient();

  const [options, setOptions] = useState<GridEntry[]>([]);

  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });

  const [displayName, setDisplayName] = useState('');

  const [ibrData] = useState<Map<string, GridEntry>>(new Map());

  const [serieId, setSerieId] = useState('tes_24');

  const [currencyType, setCurrencyType] = useState('COLTES-COP');

  const [movingAvg, setMovingAvg] = useState<LightSerie[]>([]);

  const [movingAvgDays, setMovingAvgDays] = useState(20);


  const fetchTesRawData = useCallback(
    async (view_tes: string) => {
      const { data, error } = await supabase
        .schema('xerenity')
        .from(view_tes)
        .select()
        .order('day', { ascending: true });

      if (error) {
        setCandleSerie({ name: '', values: [] });
      }

      if (data) {
        setCandleSerie({ name: '', values: data as TesYields[] });
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
      const ibrIdentifier = ibrData.get(selected_name)?.tes_months;
      if (ibrIdentifier) {
        const data = await supabase
          .schema('xerenity')
          .rpc('ibr_moving_average', {
            ibr_months: ibrIdentifier,
            average_days: moving_days,
          });

        if (data) {
          setMovingAvg([]);
        }

        if (data.data) {
          const avgValues = data.data.moving_avg as MovingAvgValue[];
          const avgSerie = Array<LightSerieValue>();
          avgValues.forEach((avgval) => {
            avgSerie.push({
              value: avgval.avg,
              time: avgval.close_date.split('T')[0],
            });
          });
          setMovingAvg([
            {
              serie: avgSerie,
              color: PURPLE_COLOR,
              name: display_name,
              type: 'line',
              priceFormat: defaultCustomFormat,
            },
          ]);
        }
      }
    },[ibrData, supabase]);

  const fetchTesMvingAvg = useCallback(
    async (
      selected_name: string,
      moving_days: number,
      display_name: string
    ) => {
      const data = await supabase.schema('xerenity').rpc('tes_moving_average', {
        tes_name: selected_name,
        average_days: moving_days,
      });

      if (data) {
        setMovingAvg([]);
      }

      if (data.data) {
        const avgValues = data.data.moving_avg as MovingAvgValue[];
        const avgSerie = Array<LightSerieValue>();
        avgValues.forEach((avgval) => {
          avgSerie.push({
            value: avgval.avg,
            time: avgval.close_date.split('T')[0],
          });
        });
        setMovingAvg([
          {
            serie: avgSerie,
            color: PURPLE_COLOR,
            name: display_name,
            type: 'line',
            priceFormat: defaultCustomFormat,
          },
        ]);
      }
    },
    [supabase, setMovingAvg]
  );

  const changeSelection = useCallback(
    async (id: string, placeholder: string) => {
      setSerieId(id);
      fetchTesRawData(id);
      setDisplayName(placeholder);

      if (id.includes('ibr')) {
        fetchTesMvingAvgIbr(id, movingAvgDays, placeholder);
      } else {
        fetchTesMvingAvg(id, movingAvgDays, placeholder);
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
        setOptions(allIbr);
      } else {
        setOptions([] as GridEntry[]);
      }
    }
  }, [currencyType, supabase, changeSelection]);

  useEffect(() => {
    fetchTesNames();
  }, [fetchTesNames]);

  const handleSelect = (eventKey: ChangeEvent<HTMLFormElement>) => {
    changeSelection(eventKey.target.id, eventKey.target.placeholder);
  };

  const handleCurrencyChange = (eventKey: string) => {
    setCurrencyType(eventKey);
  };

  const handleMonthChange = (eventKey: number) => {
    setMovingAvgDays(eventKey);
    if (serieId.includes('ibr')) {
      fetchTesMvingAvgIbr(serieId, eventKey, displayName);
    } else {
      fetchTesMvingAvg(serieId, eventKey, displayName);
    }
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
      <Container fluid>
        <div className="row">
          <div className="col-xs-12 py-3">
            <Toolbar>
              <div className="section">
                {TOOLBAR_ITEMS.map(({ name, property, icon }) => (
                  <ToolbarItem
                    className="py-3"
                    key={name}
                    name={name}
                    onClick={() => handleCurrencyChange(property)}
                    icon={icon}
                  />
                ))}
              </div>
              <div className="section">
                <Dropdown>
                  <Dropdown.Toggle>{OPCIONES}</Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item>
                      <ToolbarItem
                        name="Descargar"
                        onClick={downloadGrid}
                        icon={faFileCsv}
                      />
                    </Dropdown.Item>
                    <DropdownDivider />
                    {MONTH_OPTIONS.map((month) => (
                      <Dropdown.Item key={month}>
                        <ToolbarItem
                          name={`cambio ${month}`}
                          onClick={() => handleMonthChange(month)}
                          icon={faLongArrowAltRight}
                          key={month}
                        />
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Toolbar>
          </div>
        </div>
        <Row>
          <Col>
            <CandleSerieViewer
              candleSerie={candleSerie}
              otherSeries={movingAvg}
              fit
              shorten={false}
              normalyze={false}
              chartHeight="50rem"
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <CandleGridViewer selectCallback={handleSelect} allTes={options}  currentSelection={serieId}/>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
