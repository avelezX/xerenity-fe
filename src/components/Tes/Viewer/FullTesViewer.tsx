import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, Table } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import { Canasta,CanastaInflacion } from '@models/canasta'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'
import DisplaySerie from '@components/compare/CompareSeries'
import Form from 'react-bootstrap/Form';
import {Tes,TesYields,CandleSerie} from '@models/tes'
import CandleGridViewer from '@components/grid/CandleGrid'
import CandleSerieViewer from '@components/compare/candleViewer'


export default function FullTesViewer(){

    const supabase = createClientComponentClient()

    const [options,setOptions] = useState<Tes[]>([])

    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})

    const fetchTesNames = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').rpc('tes_get_all')
        
        if(error){
            setOptions([])
        }
  
        if(data){
          setOptions(data.tes as Tes[])
        }else{
          setOptions([] as Tes[])
        }
  
    },[supabase])    

    const fetchTesRawData = useCallback( async (view_tes:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from(view_tes).select().order('day', { ascending: false })
        
        if(error){
            setCandleSerie({name:'',values:[]})
        }

        if(data){            
            setCandleSerie({name:view_tes,values:data as TesYields[]})
        }else{
            setCandleSerie({name:'',values:[]})
        }

    },[supabase])

    useEffect(()=>{
        fetchTesNames()
      },[fetchTesNames])

    const handleSelect = (eventKey: any) => {        
        fetchTesRawData(eventKey.target.id)
    }


    return (
        <Container fluid>
            <Row>
                <Row>
                    <Col>
                        <CandleSerieViewer candleSerie={candleSerie} chartName={candleSerie.name} chartHeight={300} />
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <CandleGridViewer selectCallback={handleSelect} allTes={options}/>
                    </Col>
                </Row>
            </Row>                
        </Container>
    )
}