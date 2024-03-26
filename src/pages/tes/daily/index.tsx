'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, Nav, NavDropdown } from 'react-bootstrap';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import Container from 'react-bootstrap/Container';
import {
  LightSerie,
  LightSerieValue,
  defaultCustomFormat,
} from '@models/lightserie';
import { MovingAvgValue } from '@models/movingAvg';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import { faAreaChart, faBarChart,faFileCsv, faLineChart, faLongArrowAltRight } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import TabNavigationItem from '@components/UI/NavigationItem/NavigationItem';

import {
  TesYields,
  CandleSerie,
  GridEntry,
  TesEntryToArray,

} from '@models/tes';
import CandleGridViewer from '@components/grid/CandleGrid';
import CandleSerieViewer from '@components/compare/candleViewer';

export default function FullTesViewer() {
  const supabase = createClientComponentClient();

  const [options, setOptions] = useState<GridEntry[]>([]);

  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });

  const [displayName, setDisplayName] = useState('');

  const [ibrData, setIbrData] = useState<Map<string, GridEntry>>(new Map());

  const [serieId, setSerieId] = useState('tes_24');

  const [currencyType, setCurrencyType] = useState('COLTES-COP');

  const [movingAvg, setMovingAvg] = useState<LightSerie[]>([]);

  const [movingAvgDays, setMovingAvgDays] = useState(20);

  const fetchTesNames = useCallback(async () => {
    if (currencyType === 'COLTES-COP' || currencyType === 'COLTES-UVR') {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('get_tes_grid_raw', { money: currencyType });

      if (error) {
        setOptions([]);
      }

      if (data) {
        setOptions(data as GridEntry[]);
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
        allIbr.forEach((entry) => {
          mapping.set(entry.tes, entry);
        });

        setIbrData(mapping);

        setOptions(data as GridEntry[]);
      } else {
        setOptions([] as GridEntry[]);
      }
    }
  }, [supabase, currencyType]);

  useEffect(() => {
    fetchTesNames();
  }, [fetchTesNames]);

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
            color: '#2270E2',
            name: display_name,
            type: 'line',
            priceFormat: defaultCustomFormat,
          },
        ]);
      }
    },
    [supabase, setMovingAvg]
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
              color: '#2270E2',
              name: display_name,
              type: 'line',
              priceFormat: defaultCustomFormat,
            },
          ]);
        }
      }
    },
    [supabase, setMovingAvg, ibrData]
  );

  const handleSelect = useCallback(
    (eventKey: ChangeEvent<HTMLFormElement>) => {
      setSerieId(eventKey.target.id);
      fetchTesRawData(eventKey.target.id);
      setDisplayName(eventKey.target.placeholder);
      if (eventKey.target.id.includes('ibr')) {
        fetchTesMvingAvgIbr(
          eventKey.target.id,
          movingAvgDays,
          eventKey.target.placeholder
        );
      } else {
        fetchTesMvingAvg(
          eventKey.target.id,
          movingAvgDays,
          eventKey.target.placeholder
        );
      }
    },
    [
      fetchTesMvingAvg,
      fetchTesMvingAvgIbr,
      setSerieId,
      fetchTesRawData,
      setDisplayName,
      movingAvgDays,
    ]
  );

  const handleCurrenyChange = (eventKey: string) => {
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
    <Row>
      <Col>
      <Nav variant="pills">
          
          <TabNavigationItem 
            name="Coltes/COP" 
            onClick={() => handleCurrenyChange('COLTES-COP')} 
            icon={faLineChart}
          />
          
          <TabNavigationItem 
            name="Coltes/UVR" 
            onClick={() => handleCurrenyChange('COLTES-UVR')}
            icon={faBarChart}
          />

          <TabNavigationItem 
            name="Coltes/IBR" 
            onClick={() => handleCurrenyChange('COLTES-IBR')}
            icon={faAreaChart}
          />

          
            <NavDropdown title="Opciones" id="basic-nav-dropdown">
              <TabNavigationItem 
                name="Descargar" 
                onClick={downloadGrid}
                icon={faFileCsv}
              />
              <NavDropdown.Divider />
              {
                [20,30,50].map((month)=>[

                  <TabNavigationItem 
                    name={`cambio ${month}`} 
                  onClick={() => handleMonthChange(month)}
                  icon={faLongArrowAltRight}
                  key={month}
                /> 
                ])
              }
            </NavDropdown>
        </Nav>       
      </Col>
    </Row>
      <Row>
        <Col>
          <hr />
        </Col>
      </Row>
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
          <CandleGridViewer selectCallback={handleSelect} allTes={options} />
        </Col>
      </Row>
    </Container>
    </CoreLayout>
  );
  
}

