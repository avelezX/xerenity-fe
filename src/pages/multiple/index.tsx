'use client'

import React,{ ChangeEvent,useCallback,useState,useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Container,Row,Col, Alert } from 'react-bootstrap'

import { AdminLayout } from '@layout'
import {TesYields,CandleSerie} from '@models/tes'
import CopTesGrid from '@components/grid/SpecificGrids/copGrid'
import CandleSerieViewer from '@components/compare/candleViewer'
import IbrTesGrid from '@components/grid/SpecificGrids/ibrGrid'
import { LightSerie, LightSerieValue } from '@models/lightserie'
import { MovingAvgValue } from '@models/movingAvg'

export default function NextPage(){

    const supabase = createClientComponentClient()
    
    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})

    const [selectedSerie,setSelectedSeries] = useState<string>('')

    const [displayName,setDisplayName] = useState<string>('')

    const [movingAvg,setMovingAvg] = useState<LightSerie[]>([])

    const handleSelect = useCallback((eventKey: ChangeEvent<HTMLFormElement>) => {
        setDisplayName(eventKey.target.placeholder)
        setSelectedSeries(eventKey.target.id)

    },[])

    useEffect(()=>{

        const fetchData = async () => {
            const {data,error} =   await supabase.schema('xerenity').from(selectedSerie).select().order('day', { ascending: true })
            if(error){
                setCandleSerie({name:'',values:[]})
            }else if(data){            
                setCandleSerie({name:selectedSerie,values:data as TesYields[]})            
            }else{
                setCandleSerie({name:'',values:[]})
            }
        }

        fetchData()

    },[supabase,selectedSerie]) 

    useEffect(()=>{

        const fetchData = async () => {

            if(selectedSerie.includes('tes') || selectedSerie.includes('uvr')){
                
                const data =   await supabase.schema('xerenity').rpc('tes_moving_average',{tes_name:selectedSerie,average_days:20})
                
                if(data){
                    setMovingAvg([])
                }
        
                if(data.data){            
                    const avgValues = data.data.moving_avg as MovingAvgValue[]
                    const avgSerie = Array<LightSerieValue>()
                    avgValues.forEach((avgval)=>{
                        avgSerie.push({
                            value:avgval.avg,
                            time:avgval.close_date.split('T')[0]
                        })
                    })
                    setMovingAvg([{serie:avgSerie,color:'#2270E2',name:displayName}])
                }

            }else{
                const data =   await supabase.schema('xerenity').rpc('ibr_moving_average',{ibr_months:selectedSerie,average_days:20})
            
                
                if(data){
                    setMovingAvg([])
                }
        
                if(data.data){            
                    const avgValues = data.data.moving_avg as MovingAvgValue[]
                    const avgSerie = Array<LightSerieValue>()
                    avgValues.forEach((avgval)=>{
                        avgSerie.push({
                            value:avgval.avg,
                            time:avgval.close_date.split('T')[0]
                        })
                    })
                    setMovingAvg([{serie:avgSerie,color:'#2270E2',name:displayName}])
                }
            }

        }

        fetchData()

    },[supabase,selectedSerie,displayName])  


    return (        
        <AdminLayout >
        <Container fluid>
            <Row>
                
                    <Col sm={6}>
                        <Row>
                            <Col>
                                <Alert variant='dark'>
                                    {displayName}
                                </Alert>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <CandleSerieViewer 
                                    candleSerie={candleSerie}                        
                                    otherSeries={movingAvg} 
                                    fit
                                    shorten={false}
                                    normalyze={false}                        
                                />
                            </Col>                        
                        </Row>
                    </Col>
                    <Col sm={6}>
                        <Row>
                            <Col>
                                <Alert variant='dark'>
                                    COLTES UVR
                                </Alert>
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <CopTesGrid moneytype='COLTES-UVR' selectCallback={handleSelect}/>                        
                            </Col>
                        </Row>
                    </Col> 
            </Row>

            <Row>
                <Col>
                    <hr/>
                </Col>
            </Row>

            <Row>                
                <Col sm={6}>
                    <Row>
                        <Col>
                            <Alert variant='dark'>
                                COLTES COP
                            </Alert>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <CopTesGrid moneytype='COLTES-COP' selectCallback={handleSelect}/>
                        </Col>
                    </Row> 
                </Col>


                <Col sm={6}>
                    <Row>
                        <Col>
                            <Alert variant='dark'>
                                IBR SWAPS
                            </Alert>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <IbrTesGrid selectCallback={handleSelect}/>
                        </Col>
                    </Row> 
                </Col>


            </Row>
        </Container>
    
      </AdminLayout>
    )
}