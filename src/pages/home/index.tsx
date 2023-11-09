import { AdminLayout } from '@layout'
import Navbar from 'react-bootstrap/Navbar'
import {Col, Container, Row} from 'react-bootstrap'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import React,{ useState, useEffect } from "react"

import CardCandleSeries from '@components/charts/cardCharts/candleChart'

interface TopTes{
  tes:string;
  date_trunc:string;
  operations: number;
}

export default function HomePage(){ 

  const supabase = createClientComponentClient()
  
  const [topTes,setTopTes] = useState<TopTes[]>([])
  
  function getTodayDate(){
    const date=new Date()
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()
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
  },[supabase])

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