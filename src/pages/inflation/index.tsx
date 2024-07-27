'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Container, Row, Col } from 'react-bootstrap';
import { CoreLayout } from '@layout';
import { LightSerieValue } from 'src/types/lightserie';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faMoneyBillTrendUp,
} from '@fortawesome/free-solid-svg-icons';
import Form from 'react-bootstrap/Form';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import Panel from '@components/Panel';
import { ConsumerPrice } from 'src/types/consumerprice';

import InflationTable from './_InflationTable';

import ConsumerPriceList from './_InflationList';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

const PAGE_TITLE = 'Inflación';

export default function LoansPage() {
  const supabase = createClientComponentClient();

  const [prices, setConsumerPrices] = useState<ConsumerPrice[]>([]);

  const [selectedPrices, setSelectecConsumerPrice] = useState<number>(1);

  const [lagValue, setLagValue] = useState<number>(12);

  const [priceValues, setPriceValues] = useState<LightSerieValue[]>([]);

  const fetchPrices = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('canasta')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      toast.error('Error leyendo datos de inflación');
    } else {
      const allPrices = data as ConsumerPrice[];

      setConsumerPrices(allPrices);
    }
  }, [supabase]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('cpi_index_change', {
          lag_value: lagValue,
          id_canasta_search: selectedPrices,
        });

      if (error) {
        toast.error('Error al calcular el cpi index');
      } else {
        setPriceValues(data as LightSerieValue[]);
      }
    }

    fetchData();
  }, [supabase, selectedPrices, lagValue]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const onPriceSelect = useCallback(
    async (priceId: number) => {
      setSelectecConsumerPrice(priceId);
    },
    [setSelectecConsumerPrice]
  );

  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push(['Fecha', 'Indice CPI']);

    priceValues.forEach((price) => {
      allValues.push([price.time, price.value.toString()]);
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_inflacion.csv', 'text/csv;charset=utf-8;');
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faMoneyBillTrendUp} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <Toolbar>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row>
          <Col sm={12} md={8}>
            <Panel>
              <Chart showToolbar>
                <Chart.Bar
                  data={priceValues}
                  color={PURPLE_COLOR_100}
                  scaleId="right"
                  title={
                    prices.findLast((e) => e.id === selectedPrices)?.nombre ||
                    ''
                  }
                />
              </Chart>
              <InflationTable data={priceValues} />
            </Panel>
          </Col>
          <Col sm={12} md={4}>
            <Panel>
              <div
                style={{
                  display: 'flex',
                  padding: '15px 0',
                  justifyContent: 'start',
                  gap: '10px',
                }}
              >
                <Form.Select
                  defaultValue={lagValue}
                  onChange={(e) => {
                    setLagValue(Number(e.currentTarget.value));
                  }}
                >
                  {Array.from(Array(13).keys()).map((item) => (
                    <option key={`tr-${item}`} value={item}>
                      {`${item} Periodos de cambio en IPC`}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <ConsumerPriceList
                list={prices}
                onSelect={onPriceSelect}
                selected={selectedPrices}
              />
            </Panel>
          </Col>
        </Row>
      </Container>
      <ToastContainer />
    </CoreLayout>
  );
}
