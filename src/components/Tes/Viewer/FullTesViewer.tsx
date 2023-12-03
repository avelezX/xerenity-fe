import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card,Alert,Button, Stack,Row,Col,Form} from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import Container from 'react-bootstrap/Container'

import {TesYields,CandleSerie,GridEntry} from '@models/tes'
import CandleGridViewer from '@components/grid/CandleGrid'
import CandleSerieViewer from '@components/compare/candleViewer'

import { LightSerie,LightSerieValue } from '@models/lightserie'
import { MovingAvgValue } from '@models/movingAvg'
import { getHexColor } from '@models/hexColors'

export default function FullTesViewer(){

    const supabase = createClientComponentClient()

    const [options,setOptions] = useState<GridEntry[]>([])

    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})

    const [displayName,setDisplayName] = useState('')

    const [serieId,setSerieId] = useState('tes_24')

    const [currencyType,setCurrencyType] = useState('COP')

    const [movingAvg,setMovingAvg] = useState<LightSerie[]>([])

    const [movingAvgDays,setMovingAvgDays] =useState(20)

    const fetchTesNames = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').rpc('get_tes_grid_raw',{money:currencyType})

        if(error){
            setOptions([])
        }
  
        if(data){
          setOptions(data as GridEntry[])
        }else{
          setOptions([] as GridEntry[])
        }
  
    },[supabase,currencyType])    

    const fetchTesRawData = useCallback( async (view_tes:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from(view_tes).select().order('day', { ascending: true })
        
        if(error){
            setCandleSerie({name:'',values:[]})
        }

        if(data){            
            setCandleSerie({name:view_tes,values:data as TesYields[]})
        }else{
            setCandleSerie({name:'',values:[]})
        }

    },[supabase])

    const fetchTesMvingAvg = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').rpc('tes_moving_average',{tes_name:serieId,average_days:movingAvgDays})
        
        if(error){
            setMovingAvg([])
        }

        if(data){            
            const avgValues = data.moving_avg as MovingAvgValue[]
            const avgSerie = Array<LightSerieValue>()
            avgValues.forEach((avgval)=>{
                avgSerie.push({
                    value:avgval.avg,
                    time:avgval.close_date.split('T')[0]
                })
            })
            setMovingAvg([{serie:avgSerie,color:getHexColor(1),name:''}])
        }

    },[supabase,serieId,movingAvgDays,setMovingAvg])    

    useEffect(()=>{
        fetchTesNames()
      },[fetchTesNames])

    const handleSelect = (eventKey: ChangeEvent<HTMLFormElement>) => {
        setSerieId(eventKey.target.id)
        fetchTesRawData(eventKey.target.id)
        fetchTesMvingAvg()
        setDisplayName(eventKey.target.placeholder)
    }

    const handleCurrenyChange = (eventKey: string) => {                
        setCurrencyType(eventKey)
    }

    const handleMonthChnage = (eventKey: number) => {                
        setMovingAvgDays(eventKey)
        fetchTesMvingAvg()
    }

    return (
        <Container fluid>
            <Row>            
                <Col>
                  <Alert variant="secondary">
                    <Row>
                      <Col sm={1}>
                        <Button onClick={()=>handleCurrenyChange('COP')}>
                            COP
                        </Button>
                      </Col>
                      <Col sm={1}>
                        <Button onClick={()=>handleCurrenyChange('UVR')}>
                            UVR
                        </Button>
                      </Col>
                      <Col sm={{offset:1}}>
                        <Form>
                            <Stack direction='horizontal' gap={3}>
                                <a>Promedio Movible </a>
                                <Form.Check                                        
                                        label="20"
                                        name="group1"
                                        type="radio"
                                        id='inline-20days-1'
                                        onChange={()=>handleMonthChnage(20)}
                                    />
                                <Form.Check
                                        
                                        label="30"
                                        name="group1"
                                        type="radio"
                                        id='inline-30days-2'
                                        onChange={()=>handleMonthChnage(30)}
                                    />
                                <Form.Check
                                        label="50"
                                        name="group1"
                                        type="radio"
                                        id='inline-50days'
                                        onChange={()=>handleMonthChnage(50)}
                                    />                            
                            </Stack>
                        </Form>
                      </Col>                      
                    </Row>                      
                  </Alert>                
                </Col>          
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer 
                        candleSerie={candleSerie} 
                        chartName={displayName} 
                        otherSeries={movingAvg} 
                        fit 
                    />
                </Col>
            </Row>
            <Row>
                <Col>
                    <Card >
                        <Card.Body>
                            <Row>
                                <Col>
                                    <CandleGridViewer 
                                        selectCallback={handleSelect} 
                                        allTes={options}
                                    />
                                </Col>
                            </Row>                            
                        </Card.Body>
                    </Card>
                </Col>
            </Row>            
        </Container>
    )
}
