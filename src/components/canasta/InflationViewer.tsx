import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import { CanastaRaw,Canasta,CanastaInflacion } from '@models/canasta';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';
import React from 'react';
import Badge from 'react-bootstrap/Badge';
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

import dynamic from 'next/dynamic';
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

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



export default function InflationViewer(){
    const [tesList,setTesList] = useState<CanastaInflacion[]>([]);

    const [monthChange,setMonthChange] = useState<number>(12);

    const [options,setOptions] = useState<Canasta[]>([]);
    
    const [viewCanasta, setViewCanasta] = useState('1');    

    const supabase = createClientComponentClient()

     
    
    const fetchTesRawData = useCallback( async (canasta_id:string,month_chnage:number) =>{
        //const {data,error} =   await supabase.schema('xerenity').from('canasta_values').select().eq('id_canasta',viewCanasta).order('fecha', { ascending: false })
        
        let canasta_name;

        if(canasta_id){
            canasta_name = canasta_id;
        }else{
            canasta_name =viewCanasta
        }

        let month_new_value;

        if(month_chnage===-1){
          month_new_value = monthChange;
        }else{          
          month_new_value = month_chnage;
        }


        setViewCanasta(canasta_name)

        setMonthChange(month_new_value)
        
        const {data,error} =  await supabase.schema('xerenity').rpc('cpi_index_change',{lag_value:month_new_value,id_canasta_search:canasta_name})
        
        if(error){
            console.log(error)
            setTesList([])
        }

        if(data){
            setTesList(data.cpi_index as CanastaInflacion[])
            
        }else{
            setTesList([] as CanastaInflacion[])
        }

    },[supabase,viewCanasta,monthChange])

    const fetTesData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('canasta').select()
      
      if(error){
          console.log(error)
          setOptions([])
      }

      if(data){
        setOptions(data as Canasta[])
      }else{
        setOptions([] as Canasta[])
      }

  },[supabase,options])

  useEffect(()=>{
    fetTesData()
  },[])

    const handleCanastaSelect = (eventKey: any) => {
        setViewCanasta(eventKey)
        fetchTesRawData(eventKey,-1)
    };

    const handleMonthSelect = (eventKey: any) => {        
        setMonthChange(eventKey)
        fetchTesRawData('',eventKey)
    };
    
    function searchCanastaName(index:any){


      for(var i = 0; i < options.length; i++)
      {
        if(options[i].id == index)
        {
          return options[i].nombre;
        }
      }
      
      
    }

    return (
        <Container>
            <Row>
              <Col>
                <Nav>
                
                    <NavDropdown title="Seleccionar Canasta" id="nav-dropdown-canasta" onSelect={handleCanastaSelect}>
                      {options.map((option, idx) => (                    
                        <NavDropdown.Item eventKey={option.id} >{option.nombre}</NavDropdown.Item>
                      ))}                  
                    </NavDropdown>
                    <NavDropdown title="Cambio mes" id="nav-dropdown-mes" onSelect={handleMonthSelect}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map((option) => (                    
                        <NavDropdown.Item eventKey={option} >{option}</NavDropdown.Item>
                      ))}                  
                    </NavDropdown>
                </Nav>            
              </Col>
              <Col >
                  <Card body>Canasta {searchCanastaName(viewCanasta)}</Card>
              </Col>
              <Col>
                  <Card body>Diferencia Mes {monthChange}</Card>
              </Col>  
            </Row>
          <Row>
            <Col>
            {(typeof window !== 'undefined') &&
              <Chart 
                options={
                  {
                    chart: {
                      type: 'area',
                      height: 350
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
                        name: "Porcentaje",
                        data: tesList.map(tes => ({
                        x: tes.fecha,
                        y: tes.percentage_change
                      }))
                    }
                  ]
                }
                type="area" 
              />              
              }    
            </Col>
          </Row>
          <Row>
            <Col>
            <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Indice</th>
                    <th>Porcentaje</th>
                  </tr>
                </thead>
                <tbody>
                  {tesList.map((tes) => (
                    <tr >
                      <td>{tes.fecha}</td>
                      <td>{tes.indice}</td>
                      <td>{tes.percentage_change}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    );
}