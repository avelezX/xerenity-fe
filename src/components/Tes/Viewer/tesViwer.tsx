import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import {Tes,TesYields} from '@models/tes'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';

import type { NextPage } from 'next'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown,
  faArrowUp,
  faDownload,
  faEllipsisVertical,
  faMars,
  faSearch,
  faUsers,
  faVenus,
} from '@fortawesome/free-solid-svg-icons'
import {
  Button, ButtonGroup, Card, Dropdown, ProgressBar,
} from 'react-bootstrap'
import { Bar, Line } from 'react-chartjs-2'
import React from 'react';
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
import Chart from 'react-apexcharts'


const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)

export default function TesViever(){
    const [tesList,setTesList] = useState<TesYields[]>([]);
    
    const [options,setOptions] = useState<Tes[]>([]);
    
    const [viewTes, setMyViewTes] = useState('');

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async (view_tes:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from(view_tes).select()
        
        if(error){
            console.log(error)
            setTesList([])
        }

        if(data){
            setTesList(data as TesYields[])
            setMyViewTes(view_tes)
        }else{
            setTesList([] as TesYields[])
        }

    },[supabase,viewTes])

    const fetTesData = useCallback( async () =>{
      const {data,error} =   await supabase.schema('xerenity').rpc('tes_get_all')
      
      if(error){
          console.log(error)
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

    const handleSelect = (eventKey) => {        
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
            {(typeof window !== 'undefined') &&
              <Chart 
                options={
                  {
                    chart: {
                      type: 'candlestick',
                      height: 350
                    },
                    title: {
                      text: `${viewTes} Chart`,
                      align: 'left'
                    },
                    xaxis: {
                      type: 'datetime'
                    },
                    yaxis: {
                      tooltip: {
                        enabled: true
                      }
                    }
                  }
                } 
                series={
                  [
                    {
                      data: tesList.map(tes => ({
                        x: tes.day,
                        y: [tes.open,tes.high,tes.low,tes.close]
                      }))
                    }
                  ]
                }
                type="candlestick" 
              />              
              }    
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
                  {tesList.map((tes) => (
                    <tr >
                      <td>{tes.day}</td>
                      <td>{tes.open}</td>
                      <td>{tes.high}</td>
                      <td>{tes.low}</td>
                      <td>{tes.close}</td>
                      <td>{tes.volo}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    );
}