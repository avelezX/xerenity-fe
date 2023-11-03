import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import {Tes,TesYields} from '@models/tes'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';
import React from 'react';
import dynamic from 'next/dynamic';
import CandleSerieViewer from '@components/compare/candleViewer';

import { CandleSerie } from '@models/tes';


const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function TesViever(){
    
    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})
    
    const [options,setOptions] = useState<Tes[]>([]);
    
    const [viewTes, setMyViewTes] = useState('');

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async (view_tes:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from(view_tes).select().order('day', { ascending: false })
        
        if(error){
            console.log(error)
            setCandleSerie({name:'',values:[]})
        }

        if(data){            
            setCandleSerie({name:view_tes,values:data as TesYields[]})
            setMyViewTes(view_tes)
        }else{
            setCandleSerie({name:'',values:[]})
        }

    },[supabase,viewTes])

    const fetTesData = useCallback( async () =>{
      const {data,error} =   await supabase.schema('xerenity').rpc('tes_get_all')
      
      if(error){
          setOptions([])
      }

      if(data){
        setOptions(data.tes as Tes[])
      }else{
        setOptions([] as Tes[])
      }

  },[supabase,options])

  useEffect(()=>{
    fetTesData()
  },[])

    const handleSelect = (eventKey: any) => {        
        fetchTesRawData(`${eventKey}`)
    };

    
    return (
        <Container>
            <Row>
              <Nav variant="pills" activeKey="1" onSelect={handleSelect}>
                <NavDropdown title="Seleccionar Tes" id="nav-dropdown">
                  {options.map((option, idx) => (                    
                    <NavDropdown.Item eventKey={option.name} >{option.name}</NavDropdown.Item>
                  ))}
                </NavDropdown>
              </Nav>
            </Row>
          <Row>
            <Col>
              <CandleSerieViewer candleSerie={candleSerie} chartName={candleSerie.name} chartHeight={300} />
            </Col>
          </Row>
          <Row>
            <Col>
            <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>low</th>
                    <th>Close</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {candleSerie.values.map((tes) => (
                    <tr >
                      <td>{tes.day}</td>
                      <td>{tes.open}</td>
                      <td>{tes.high}</td>
                      <td>{tes.low}</td>
                      <td>{tes.close}</td>
                      <td>{tes.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    );
}