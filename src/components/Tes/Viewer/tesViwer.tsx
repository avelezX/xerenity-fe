import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import {Tes} from '@models/tes'
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

const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)

export default function TesViever(){
    const [tesList,setTesList] = useState<Tes[]>([]);
    const [loading,setIsLoading] = useState(true);

    const options = ["tes_24", "tes_25", "tes_26", "tes_27", "tes_28", "tes_29", "tes_30", "tes_31"];
    
    const [viewTes, setMyViewTes] = useState(options[0]);

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from(viewTes).select()
        
        if(error){
            console.log(error)
            setTesList([])
        }

        if(data){
            setTesList(data as Tes[])
        }else{
            setTesList([] as Tes[])
        }

    },[supabase,viewTes])

    useEffect(()=>{
        fetchTesRawData()
    },[fetchTesRawData])

    const handleSelect = (eventKey) => setMyViewTes(`${eventKey}`);
  

    return (
        <Container>
            <Row>
              <Nav variant="pills" activeKey="1" onSelect={handleSelect}>
                <NavDropdown title="Seleccionar Tes" id="nav-dropdown">
                  {options.map((option, idx) => (                    
                    <NavDropdown.Item eventKey={option} >{option}</NavDropdown.Item>
                  ))}                  
                </NavDropdown>
              </Nav>             
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
          <Row>
            <Col>
              <Line 
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: true,
                    text: viewTes,
                  },
                },
              }}

              data={{
                labels: tesList.map((tes) => [tes.day]),
                datasets: [
                  {
                    fill: true,
                    label: 'High',
                    data: tesList.map((tes) => tes.high),
                    borderColor: 'rgb(15,119,109)',
                    backgroundColor: 'rgba(15,119,109, 0.5)',
                  },
                  {
                    fill: true,
                    label: 'Low',
                    data: tesList.map((tes) => tes.low),
                    borderColor: 'rgb(96,204,194)',
                    backgroundColor: 'rgba(96,204,194, 0.5)',
                  },
                  {
                    fill: true,
                    label: 'Close',
                    data: tesList.map((tes) => tes.close),
                    borderColor: 'rgb(255,225,141)',
                    backgroundColor: 'rgba(255,225,141, 0.5)',
                  },
                  {
                    fill: true,
                    label: 'Open',
                    data: tesList.map((tes) => tes.open),
                    borderColor: 'rgb(1255,218,30)',
                    backgroundColor: 'rgba(255,218,30, 0.5)',
                  },
                ],
              }}
              />
            </Col>
          </Row>
      
      </Container>
    );
}