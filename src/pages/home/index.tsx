
import { AdminLayout } from '@layout'
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
  Button, ButtonGroup, Card, Col, Container, Dropdown, ProgressBar, Row,
} from 'react-bootstrap'

import React from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import { useState, useEffect,useCallback } from "react";

import CardCandleSeries from '@components/charts/cardCharts/candleChart'

interface TopTes{
  tes:string, 
  date_trunc:string,
  operations: number
}

import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';

import NavDropdown from 'react-bootstrap/NavDropdown';

export default function HomePage(){ 

  const supabase = createClientComponentClient()
  
  const [topTes,setTopTes] = useState<TopTes[]>([])
  
  function getTodayDate(){
    const date=new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    return `${year}-${month}-${day}`
  }

  useEffect(()=>{    
    const getTopTest = async () =>{
      const {data,error} =  await supabase.schema('xerenity').rpc('most_traded_tes',{limit_tes:3,fecha:getTodayDate()})

      if(!error){
        setTopTes(data.top_tes as TopTes[])
      }      
    }
    getTopTest()
  },[])

  return (
    <AdminLayout>
      <Container fluid>
      
        <Navbar expand="lg" className="bg-body-tertiary">
          <Container>
            <Navbar.Brand href="#home">Los Tes mas transados en {getTodayDate()}</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            
          </Container>
        </Navbar>
        <Container>          
            <Row>
            {
                topTes.map(
                  (tes_data)=>(
                  <Col key={tes_data.tes}>
                    <CardCandleSeries tableName={tes_data.tes} />
                  </Col>
                )
              )
            }
            </Row>
        </Container>        
      </Container>
    </AdminLayout>
  )
}