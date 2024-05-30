'use client';

import React, {
  useCallback,
  useState,
  useEffect,
} from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Container, Row, Col } from 'react-bootstrap';
import { CoreLayout } from '@layout';
import { LightSerieValue } from '@models/lightserie';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
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
import { Canasta } from '@models/canasta';

import InflationTable from './_InflationTable';



import CanastaList from './_InflationList';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;


export default function LoansPage() {
    const supabase = createClientComponentClient();

    const [canastas,setCanastas] = useState<Canasta[]>([]);

    const [selectedCanasta,setSelectecCanasta] = useState<number>(1);

    const [lagValue,setLagValue]= useState<number>(12);

    const [canastaValues,setCanastaValues]= useState<LightSerieValue[]>([]);

    const fetchCanastas = useCallback(async () => {
        
        const { data, error } = await supabase.schema('xerenity').from('canasta').select('*').order('id',{ascending:true});

        if(error){
            toast.error('Error leyendo datos de inflacion');
        }else{
            const allCanastas = data as Canasta[];

            setCanastas(allCanastas);
        }

    
    }, [supabase]);

    useEffect(() => {
      async function fetchData() {
        const { data, error } = await supabase.schema('xerenity').rpc('cpi_index_change', { lag_value: lagValue,id_canasta_search:selectedCanasta });

        if(error){
          toast.error('Error al calcular el cpi index');
        }else{
          setCanastaValues(data as LightSerieValue[]);
        }
      }

      fetchData();
    }, [supabase,selectedCanasta,lagValue]);


    const onCanastaSelect = useCallback(
        async (
            canastaId: number,
        ) => {
            setSelectecCanasta(canastaId);
        },
        [setSelectecCanasta]
    );


    useEffect(() => {
        fetchCanastas();
      }, [fetchCanastas]);


    const downloadSeries = () => {
        const allValues: string[][] = [];
        allValues.push([
          'Fecha',
          'Indice CPI',
        ]);
        
        canastaValues.forEach((val)=>{
          allValues.push([val.time,val.value.toString()]);
        });

        const csv = ExportToCsv(allValues);

        downloadBlob(csv, 'xerenity_inflacion.csv', 'text/csv;charset=utf-8;');
    };

  return (
    <CoreLayout>

      <ToastContainer />
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faMoneyBillTrendUp} size="1x" />
              <h4>Inflacion</h4>
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
              <Chart chartHeight={600} noCard>
                <Chart.Bar
                  data={canastaValues}
                  color={PURPLE_COLOR_100}
                  scaleId="right"
                  title={canastas.findLast((e)=>e.id ===selectedCanasta)?.nombre || ''}
                />
              </Chart>
              <InflationTable data={canastaValues} meses={lagValue}/>
            </Panel>
          </Col>
          <Col sm={12} md={4}>
            <Panel>
            <div
                style={{
                  display: 'flex',
                  padding: '15px 0',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                
                <Form.Select
                  defaultValue={lagValue}
                  onChange={(e)=>{
                    setLagValue(Number(e.currentTarget.value));
                  }}
                >
                  {
                    Array.from(Array(13).keys()).map((a)=>(
                      <option key={`tr-${a}`} value={a}>{a} Periodos de cambio en IPC</option>
                    ))
                  }
                </Form.Select>
              </div>              
              <CanastaList 
                list={canastas}
                onSelect={onCanastaSelect}
                selected={selectedCanasta}
            />
            </Panel>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
