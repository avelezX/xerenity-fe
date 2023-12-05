import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card,Row,Col,Nav,Form,Stack,Dropdown,NavItem,NavLink} from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import Container from 'react-bootstrap/Container'

import {TesYields,CandleSerie,GridEntry,TesEntryToArray} from '@models/tes'
import CandleGridViewer from '@components/grid/CandleGrid'
import CandleSerieViewer from '@components/compare/candleViewer'

import { LightSerie,LightSerieValue } from '@models/lightserie'
import { MovingAvgValue } from '@models/movingAvg'
import { getHexColor } from '@models/hexColors'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFileCsv
} from '@fortawesome/free-solid-svg-icons'


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

    const fetchTesMvingAvg = useCallback( async (selected_name:string,moving_days:number) =>{
        const data =   await supabase.schema('xerenity').rpc('tes_moving_average',{tes_name:selected_name,average_days:moving_days})
        
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
            setMovingAvg([{serie:avgSerie,color:getHexColor(1),name:''}])
        }

    },[supabase,setMovingAvg])    

    useEffect(()=>{
        fetchTesNames()
      },[fetchTesNames])

    const handleSelect = (eventKey: ChangeEvent<HTMLFormElement>) => {
        setSerieId(eventKey.target.id)
        fetchTesRawData(eventKey.target.id)
        fetchTesMvingAvg(eventKey.target.id,movingAvgDays)
        setDisplayName(eventKey.target.placeholder)
    }


    const handleCurrenyChange = (eventKey: string) => {                
        setCurrencyType(eventKey)
    }

    const handleMonthChnage = (eventKey: number) => {                
        setMovingAvgDays(eventKey)
        fetchTesMvingAvg(serieId,eventKey)
    }

    const downloadGrid = () => {                
        const allValues: string[][]=[]
        allValues.push([
            'open',
            'high',
            'low',
            'close',
            'volume',
            'day',
        ]
        )
        candleSerie.values.forEach((entry)=>{
            allValues.push(TesEntryToArray(entry))
        })

        const csv=ExportToCsv(allValues)

        downloadBlob(csv,`xerenity_${displayName}.csv`, 'text/csv;charset=utf-8;')
    }    

    return (
        <Container fluid>
            <Row>            
                <Col>
                    <Nav justify  >
                        <Nav.Item onClick={()=>handleCurrenyChange('COP')}> 
                            <Nav.Link >COP</Nav.Link>
                        </Nav.Item>
                        <Nav.Item onClick={()=>handleCurrenyChange('UVR')}>
                            <Nav.Link >UVR</Nav.Link>
                        </Nav.Item>                      
                        <Dropdown as={NavItem}>
                            <Dropdown.Toggle as={NavLink}>Configuracion</Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item onClick={downloadGrid}> 
                                    Exportar CSV <FontAwesomeIcon size="xs" icon={faFileCsv} />
                                </Dropdown.Item>
                                <Dropdown.Item>
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
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Nav>
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
