import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import {TesRaw} from '@models/tes'
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

export default function TesRawViever(){
    const [tesList,setTesList] = useState<TesRaw[]>([]);
    const [loading,setIsLoading] = useState(true);

    const options = ["tes_24_raw", "tes_25_raw", "tes_26_raw", "tes_27_raw", "tes_28_raw", "tes_29_raw", "tes_30_raw", "tes_31_raw"];
    
    const [viewTes, setMyViewTes] = useState(options[0]);

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async () =>{
        const res =   await supabase.schema('xerenity').from(viewTes).select()
        if(res.error){
            console.log(res.error)
            setTesList([])
        }

        if(res.data){
            setTesList(res.data as TesRaw[])
        }else{
            setTesList([] as TesRaw[])
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
                    <th>Price</th>
                    <th>volume</th>
                    <th>yield</th>
                  </tr>
                </thead>
                <tbody>
                  {tesList.map((tes) => (
                    <tr >
                      <td>{tes.date}</td>
                      <td>{tes.price}</td>
                      <td>{tes.volume}</td>
                      <td>{tes.yield}</td>ß
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
                labels: tesList.map((tes) => [tes.date]),
                datasets: [
                  {
                    fill: true,
                    label: 'Yield',
                    data: tesList.map((tes) => tes.yield),
                    borderColor: 'rgb(15,119,109)',
                    backgroundColor: 'rgba(15,119,109, 0.5)',
                  },
                  {
                    fill: true,
                    label: 'Price',
                    data: tesList.map((tes) => tes.price),
                    borderColor: 'rgb(96,204,194)',
                    backgroundColor: 'rgba(96,204,194, 0.5)',
                  },
                  {
                    fill: true,
                    label: 'Volume',
                    data: tesList.map((tes) => tes.volume),
                    borderColor: 'rgb(255,225,141)',
                    backgroundColor: 'rgba(255,225,141, 0.5)',
                  }
                ],
              }}
              />
            </Col>
          </Row>
      
      </Container>
    );
}