import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card,Alert,Button} from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Nav from 'react-bootstrap/Nav'
import {TesYields,CandleSerie} from '@models/tes'
import CandleGridViewer from '@components/grid/CandleGrid'
import CandleSerieViewer from '@components/compare/candleViewer'
import { GridEntry } from '@models/tes'
import { LightSerie,LightSerieValue } from '@models/lightserie'
import { MovingAvgValue } from '@models/movingAvg'

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
            console.log(error)
        }

        if(data){            
            let avgValues = data.moving_avg as MovingAvgValue[]
            let avgSerie = Array<LightSerieValue>()
            avgValues.forEach((avgval)=>{
                avgSerie.push({
                    value:avgval.avg,
                    time:avgval.close_date.split('T')[0]
                })
            })
            setMovingAvg([{serie:avgSerie}])
        }

    },[supabase,serieId,movingAvgDays])    

    useEffect(()=>{
        fetchTesNames()
      },[fetchTesNames])

    const handleSelect = (eventKey: any) => {
        setSerieId(eventKey.target.id)
        fetchTesRawData(eventKey.target.id)
        fetchTesMvingAvg()
        setDisplayName(eventKey.target.placeholder)
    }

    const handleCurrenyChange = (eventKey: string) => {                
        setCurrencyType(eventKey)
    }

    const handleRangeChnage = (eventKey: any) => {                
        setMovingAvgDays(eventKey.target.value)
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
                    </Row>                      
                  </Alert>                
                </Col>          
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer candleSerie={candleSerie} chartName={displayName} otherSeries={movingAvg} fit={true}/>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Card >

                        <Card.Body>
                            <Row>
                                <Col>
                                    <CandleGridViewer selectCallback={handleSelect} allTes={options}/>
                                </Col>
                            </Row>                            
                        </Card.Body>
                    </Card>
                </Col>
            </Row>            
        </Container>
    )
}
