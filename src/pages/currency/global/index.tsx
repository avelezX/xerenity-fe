'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row, Col, Table } from 'react-bootstrap';
import React, { useState, useCallback, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import {
  LightSerie,
  LightSerieValue,
  lightSerieValueArray,
} from 'src/types/lightserie';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import tokens from 'design-tokens/tokens.json';
import {
  faClose,
  faFileCsv,
  faMoneyBill,
  faSquarePollHorizontal,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Chart from '@components/chart/Chart';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import Toolbar from '@components/UI/Toolbar';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import randomColor from 'src/utils/generateRandomColor';
import MonedasModal from './_MonedasModal';

const designSystem = tokens.xerenity;
const GRAY_COLOR_300 = designSystem['gray-300'].value;

const PAGE_TITLE = 'Monedas: Global';

export default function CurrecnyViewer() {
  const supabase = createClientComponentClient();
  const [showCurrencyModal, onShowCurrencyModal] = useState<boolean>(false);
  const [applyFunctions, setApplyunctions] = useState<string[]>([]);
  const normalize = useRef<boolean>(false);
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
      if (data) {
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
    async (currencyName: string, color: string) => {
      const serie = await FetchSerieValues(currencyName, color);

      if (serie) {
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

  const onModalSave = (currencyFrom: string, currencyTo: string) => {
    handleAddSerie(`${currencyFrom}:${currencyTo}`, GRAY_COLOR_300);
    onShowCurrencyModal(false);
  };

  const handleColorChnage = useCallback(
    async (serieId: string, newColor: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        if (key === serieId) {
          newSelection.set(key, {
            name: value.name,
            color: newColor,
            serie: value.serie,
            type: value.type,
            priceFormat: value.priceFormat,
            axisName: value.axisName,
          } as LightSerie);
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
        allValues.push([value.name].concat(lightSerieValueArray(entry)));
      });
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;');
  };

  const handleNormalize = () => {
    normalize.current = !normalize.current;
    if (normalize.current) {
      setApplyunctions(['normalize']);
    } else {
      setApplyunctions([]);
    }
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
              <Button variant="outline-primary" onClick={handleNormalize}>
                <Icon icon={faSquarePollHorizontal} className="mr-4" />
                Normalizar
              </Button>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
              <Button
                variant="primary"
                onClick={() => onShowCurrencyModal(true)}
              >
                <Icon icon={faMoneyBill} className="mr-4" />
                Pares de Monedas
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row>
          <Col>
            <Chart chartHeight={700} showToolbar>
              {Array.from(selectedSeries.values()).map((data) => (
                <Chart.Line
                  key={`chart-${data.name}`}
                  data={data.serie}
                  color={data.color}
                  title={data.name}
                  scaleId="right"
                  applyFunctions={applyFunctions}
                />
              ))}
            </Chart>
          </Col>
        </Row>
        <Row>
          <Col>
            <Table
              bordered
              hover
              responsive="sm"
              style={{ textAlign: 'center' }}
            >
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Color</th>
                  <th style={{ width: '2%' }}> Quitar</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(selectedSeries.values()).map((data) => (
                  <tr key={`t-row-serie${data.name}`}>
                    <td>{data.name}</td>
                    <td>
                      <Button
                        onClick={() =>
                          handleColorChnage(data.name, randomColor())
                        }
                      >
                        Cambiar color
                      </Button>
                    </td>
                    <td>
                      <Button aria-label="descargar" variant="outline-primary">
                        <Icon
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
      <MonedasModal
        show={showCurrencyModal}
        onCancel={() => onShowCurrencyModal(false)}
        onSave={onModalSave}
      />
    </CoreLayout>
  );
}
