import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, Form, Table } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import { Canasta,CanastaInflacion } from '@models/canasta'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'
import { GenericSerie } from '@models/serie'
import DisplaySerie from '@components/compare/CompareSeries'
import InputGroup from 'react-bootstrap/InputGroup'


export interface SerieColSelectorProps{
    selectCallback:any;
}

export default function SeriesColPicker({selectCallback}:SerieColSelectorProps){

    const supabase = createClientComponentClient()

    const [series,setSeries] =useState<GenericSerie []>([])


    const FetchSeriesNames = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('banrep_serie').select('id,nombre')
        
        if(error){            
            setSeries([])
        }

        if(data){
            setSeries(data as GenericSerie[])            
        }else{
            setSeries([] as GenericSerie[])
        }

    },[supabase])    

    useEffect(()=>{
        FetchSeriesNames()
    },[FetchSeriesNames])

    return (
        <Container>
            <Row>
                <Form >
                    {                    
                        series.map((serie)=>[                      
                            <Row>                                
                                <InputGroup className="mb-3">                                    
                                    <Col >
                                        <Form.Check // prettier-ignore
                                            type="switch"
                                            id={serie.id}                                                                                        
                                            label={serie.nombre.slice(0,20)}
                                            onChange={(e) => selectCallback(e, serie.id)}
                                        />
                                    </Col>
                                </InputGroup>                                
                            </Row>
                        ])
                    }
                </Form>
            </Row>
        </Container>
    )
}