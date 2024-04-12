'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, Table, DropdownDivider} from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState,  useCallback,  useRef, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import { 
  LightSerie,
  LightSerieValue,
  defaultCustomFormat,
} from '@models/lightserie';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import {
  faDollarSign,
  faEuro,
  faFileCsv,
  faLongArrowAltRight,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import ToolbarItem from '@components/UI/Toolbar/ToolbarItem';
import {
  TesYields,
  CandleSerie,
  TesEntryToArray,
} from '@models/tes';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import NewPrevTag from '@components/price/NewPrevPriceTag';
import { MovingAvgValue } from '@models/movingAvg';

const TOOLBAR_ITEMS = [
  {
    name: 'USD:COP',
    property: 'USD:COP',
    icon: faDollarSign,
  },
  {
    name: 'USD:EUR',
    property: 'USD:EUR',
    icon: faEuro,
  }
];

const MONTH_OPTIONS = [20, 30, 50];

const designSystem = tokens.xerenity;
const PURPLE_COLOR = designSystem['purple-100'].value;
const GRAY_COLOR_300 = designSystem['gray-300'].value;

const OPCIONES = 'Opciones';

export default function CurrecnyViewer() {
  const supabase = createClientComponentClient();

  const [candleSerie, setCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });


  const currencyName = useRef<string>('USD:COP');

  const [volumenSerie,setvolumenSerie] = useState<LightSerieValue[]>([]);

  const movingAvgDays = useRef<number>(20);

  const [movingAvg, setMovingAvg] = useState<LightSerie>();

  const fetchCurrencyRawData = useCallback(async () => {
      
      const { data, error } = await supabase.schema('xerenity').rpc('currency_exchange',{currency_name:currencyName.current});

      if (error) {
        setCandleSerie({ name: '', values: [] });
        toast.error(error.message);
      }else if (data) {
        const allData=data as TesYields[];

        const volData:{ time: string; value: number }[] = [];

        allData.forEach((tes) => {
          volData.push({time:tes.day.split('T')[0],value:tes.volume});
        });

        setvolumenSerie(volData);
        setCandleSerie({ name: '', values: allData });
        
      } else {
        setCandleSerie({ name: '', values: [] });
      }
    },
    [supabase]
  );


  const handleCurrencyChange = (eventKey: string) => {
    currencyName.current=eventKey;
    fetchCurrencyRawData();
  };

  const downloadGrid = () => {
    const allValues: string[][] = [];
    allValues.push(['open', 'high', 'low', 'close', 'volume', 'day']);
    candleSerie.values.forEach((entry) => {
      allValues.push(TesEntryToArray(entry));
    });

    const csv = ExportToCsv(allValues);
    downloadBlob(csv, `xerenity_${currencyName.current}.csv`, 'text/csv;charset=utf-8;');
  };

  const fecthMovingAverag = useCallback(
    async (
    ) => {
      if(currencyName.current){
        const {data,error} = await supabase
        .schema('xerenity')
        .rpc('currency_moving_average', {
          currency_name: currencyName.current,
          average_days: movingAvgDays.current,
        });

        if(error){
          toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
        }else if (data) {
          const avgValues = data.moving_avg as MovingAvgValue[];
          const avgSerie = Array<LightSerieValue>();
          avgValues.forEach((avgval) => {
            avgSerie.push({
              value: avgval.avg,
              time: avgval.close_date.split('T')[0],
            });
          });
          setMovingAvg(
            {
              serie: avgSerie,
              color: PURPLE_COLOR,
              name: currencyName.current,
              type: 'line',
              priceFormat: defaultCustomFormat,
              axisName:'right'
            },
          );
      }
      }
    },[supabase]);  


  const handleMonthChange = (eventKey: number) => {
    
    movingAvgDays.current=eventKey;
    fecthMovingAverag();
  };  

  useEffect(() => {
    fetchCurrencyRawData();
    fecthMovingAverag();
  }, [fetchCurrencyRawData,fecthMovingAverag]);

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
                          name={`Promedio Movil ${month}`}
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
            <Chart chartHeight={800}>
                <Chart.Candle
                  data={candleSerie.values}
                  scaleId='right'
                />
                <Chart.Volume
                  data={volumenSerie}
                  scaleId='left'
                  title={currencyName.current}
                  color={GRAY_COLOR_300}
                />
                {
                  movingAvg?(<Chart.Line
                        data={movingAvg.serie}
                        color={PURPLE_COLOR}
                        scaleId='right'
                        title={movingAvg.name}
                  />)
                  :(null)
                }                
            </Chart>
          </Col>
        </Row>
        <Row>
          <Col>
          <Table
              bordered
              hover
              responsive="sm"
              style={{ fontSize: 13, textAlign: 'center' }}
            >
              <thead>
                <tr>

                  <th>Fecha/Hora</th>
                  
                  <th>Change</th>
                  
                  <th>Last</th>

                  <th>Open</th>

                  <th>Low</th>

                  <th>High</th>

                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {candleSerie.values.map((tesValue) => [
                  
                  <tr key={`tr-grid-row${tesValue.day}`}>     
                    <td>{tesValue.day}</td>
                    <td>
                      <NewPrevTag current={tesValue.open} prev={tesValue.close}>
                        {((tesValue.close - tesValue.open) * 100*-1).toFixed(1)} bps
                      </NewPrevTag>               
                    </td>
                    <td>{tesValue.close.toFixed(2)}</td>
                    <td>{tesValue.open.toFixed(2)}</td>
                    <td>{tesValue.low.toFixed(2)}</td>
                    <td>{tesValue.high.toFixed(2)}</td>
                    <td>{(tesValue.volume).toFixed(2)} MMM</td>                    
                  </tr>,
                ])}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}