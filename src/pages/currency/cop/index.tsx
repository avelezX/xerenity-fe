'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, DropdownDivider } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { LightSerieValue } from '@models/lightserie';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import {
  faCaretRight,
  faEye,
  faFileCsv,
  faMoneyBill,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { TesYields, CandleSerie, TesEntryToArray } from '@models/tes';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { MovingAvgValue } from '@models/movingAvg';
import Toolbar from '@components/UI/Toolbar';
import PageTitle from '@components/PageTitle';

const MONTH_OPTIONS = [20, 30, 50];
const designSystem = tokens.xerenity;
const PURPLE_COLOR = designSystem['purple-100'].value;
const PAGE_TITLE = 'Monedas: Peso Colombiano';
const OPCIONES = 'Opciones';
const VER_PROMEDIO = 'Ver promedio';
const OCULTAR_PROMEDIO = 'Ocultar promedio';

export default function CurrecnyViewer() {
  const supabase = createClientComponentClient();

  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });

  const currencyName = useRef<string>('USD:COP');

  const [hideAvg, setHideAvg] = useState<boolean>(true);

  const movingAvgDays = useRef<number>(20);

  const [movingAvg, setMovingAvg] = useState<LightSerieValue[]>([]);

  const fetchCurrencyRawData = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .rpc('currency_exchange', { currency_name: currencyName.current });

    if (error) {
      setCandleSerie({ name: '', values: [] });
      toast.error(error.message);
    } else if (data) {
      const allData = data as TesYields[];

      const volData: { time: string; value: number }[] = [];

      allData.forEach((tes) => {
        volData.push({ time: tes.day.split('T')[0], value: tes.volume });
      });

      setCandleSerie({ name: '', values: allData });
    } else {
      setCandleSerie({ name: '', values: [] });
    }
  }, [supabase]);

  const fecthMovingAverag = useCallback(async () => {
    if (currencyName.current) {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('currency_moving_average', {
          currency_name: currencyName.current,
          average_days: movingAvgDays.current,
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
        setMovingAvg(avgSerie);
      }
    }
  }, [supabase]);

  const handleMonthChange = (eventKey: number) => {
    movingAvgDays.current = eventKey;
    fecthMovingAverag();
  };

  useEffect(() => {
    fetchCurrencyRawData();
    fecthMovingAverag();
  }, [fetchCurrencyRawData, fecthMovingAverag]);

  const downloadGrid = () => {
    const allValues: string[][] = [];
    allValues.push(['open', 'high', 'low', 'close', 'volume', 'day']);
    candleSerie.values.forEach((entry) => {
      allValues.push(TesEntryToArray(entry));
    });

    const csv = ExportToCsv(allValues);
    downloadBlob(
      csv,
      `xerenity_${currencyName.current}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faMoneyBill} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
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
                  <Dropdown.Item onClick={() => setHideAvg(!hideAvg)}>
                    <div className="d-flex gap-2 align-items-center">
                      <Icon icon={hideAvg ? faEye : faEyeSlash} />
                      <span>{hideAvg ? VER_PROMEDIO : OCULTAR_PROMEDIO}</span>
                    </div>
                  </Dropdown.Item>
                  {hideAvg &&
                    MONTH_OPTIONS.map((month) => (
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
              {hideAvg || (
                <Chart.Line
                  data={movingAvg}
                  color={PURPLE_COLOR}
                  scaleId="right"
                  title={currencyName.current}
                />
              )}
            </Chart>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
