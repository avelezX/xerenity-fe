'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, Table, DropdownDivider, Button} from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import React, { useState,  useCallback,  useRef, useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import {
  LightSerie,
  LightSerieValue,
} from '@models/lightserie';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import {
  faClose,
  faDollarSign,
  faEuro,
  faFileCsv,
  faLongArrowAltRight,
  faPlus,
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
import { CurrencySerie } from '@models/currency';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';




const MONTH_OPTIONS = [20, 30, 50];
const designSystem = tokens.xerenity;
const PURPLE_COLOR = designSystem['purple-100'].value;
const GRAY_COLOR_300 = designSystem['gray-300'].value;
const OPCIONES = 'Opciones';




export function LightSerieValueArray(entry: LightSerieValue) {
  return [entry.time.toString(), entry.value.toFixed(2).toString()];
}

export default function CurrecnyViewer() {
  const supabase = createClientComponentClient();


  const [selectedSeries, setSelectedSeries] = useState<Map<string, LightSerie>>(
    new Map()
  );

  const FetchSerieValues = useCallback(
    async (idSerie: string, newColor: string) => {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('get_currency', { currency_name: idSerie });

      if (error) {
        toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
        return undefined;
      }
      if(data){
        return {
          serie: data as LightSerieValue[],
          color: newColor,
          name: idSerie,
        } as LightSerie;
      }

      return undefined;

    },
    [supabase]
  );

  const handleAddSerie = useCallback(
    async (
      currencyName: string,
      color: string
    ) => {
      
      const serie=await FetchSerieValues(currencyName, color);

      if(serie){
        const newSelection = new Map<string, LightSerie>();

        Array.from(selectedSeries.entries()).forEach(([key, value]) => {
          newSelection.set(key, value);
        });        

        newSelection.set(currencyName, serie);

        setSelectedSeries(newSelection);
      }
    },
    [selectedSeries, setSelectedSeries, FetchSerieValues]
  );


  const handleColorChnage = useCallback(
    async (serieId: string, newColor: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        if (key === serieId) {
          newSelection.set(key, {
            serie: value.serie,
            color: newColor,
            name: value.name,
          });
        } else {
          newSelection.set(key, value);
        }
      });

      setSelectedSeries(newSelection);
    },
    [selectedSeries]
  );

  const handleRemoveSerie = useCallback(
    async (serieId: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        newSelection.set(key, value);
      });

      newSelection.delete(serieId);

      setSelectedSeries(newSelection);
    },
    [selectedSeries]
  );  


  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push(['serie', 'time', 'value']);

    Array.from(selectedSeries.values()).forEach((value) => {
      value.serie.forEach((entry) => {
        allValues.push([value.name].concat(LightSerieValueArray(entry)));
      });
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;');
  };

  return (
    <CoreLayout>
      <Container fluid>
        <div className="row">
          <div className="col-xs-12 py-3">
            <Toolbar>
              <div className="section">
              <ToolbarItem
                    className="py-3"
                    name='Anadir'
                    onClick={() => {
                      const name = prompt("Enter your name:", "John");
                      if(name){
                        handleAddSerie(name,PURPLE_COLOR);
                      }
                    }}
                    icon={faPlus}
                  />
              </div>
            </Toolbar>
          </div>
        </div>
        <Row>
          <Col>
            <Chart chartHeight={800}>
              {Array.from(selectedSeries.values()).map((data,index)=>(
                <Chart.Line
                  key={`chart-${data.name}`}
                  data={data.serie}
                  color={data.color}
                  title={data.name}
                  scaleId={(index +1) %2 === 0 ? 'right':'left'}
                />
              ))}                              
            </Chart>
          </Col>
        </Row>
        <Row>
        <Col>
          <Table bordered hover responsive="sm" style={{ textAlign: 'center' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th style={{ width: '2%' }}> Quitar</th>
              </tr>
            </thead>
            <tbody>
            {Array.from(selectedSeries.values()).map((data)=>(
                <tr key={`t-row-serie${data.name}`}>
                  <td>
                    {data.name}
                  </td>
                  <td>
                      <Button aria-label="descargar" variant="outline-primary">
                        <FontAwesomeIcon
                          size="xs"
                          icon={faClose}
                          onClick={() => handleRemoveSerie(data.name)}
                        />
                      </Button>
                    </td>                  
                </tr>
              ))} 
            </tbody>
          </Table>
        </Col>
      </Row>
      </Container>
    </CoreLayout>
  );
}
