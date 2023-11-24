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
import { GridEntry } from '@models/tes'
import SimpleLineChart from '@components/simpleCharts/SimpleLineChart'
import SimpleAreaChart from '@components/simpleCharts/SimpleAreaChart'
import SimpleBarChart from '@components/simpleCharts/SimpleBarChart'
import Alert from 'react-bootstrap/Alert';
import {  Line,Area,Bar,Rectangle } from 'recharts';

export default function FullTesViewer(){

    const supabase = createClientComponentClient()

    const [options,setOptions] = useState<GridEntry[]>([])

    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})

    const [displayName,setDisplayName] = useState('')

    const fetchTesNames = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').rpc('get_tes_grid_raw',{money:'COP'})
        
        console.log(data)

        if(error){
            setOptions([])
        }
  
        if(data){
          setOptions(data as GridEntry[])
        }else{
          setOptions([] as GridEntry[])
        }
  
    },[supabase])    

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

    useEffect(()=>{
        fetchTesNames()
      },[fetchTesNames])

    const handleSelect = (eventKey: any) => {        
        fetchTesRawData(eventKey.target.id)
        setDisplayName(eventKey.target.placeholder)
    }


    return (
        <Container fluid>
            <Row>
                <Row>
                    <Col >
                        <Container>                     
                            <Alert variant={'light'} style={{ width: '100%', height:'15rem' }}>                            
                                <SimpleLineChart data={candleSerie.values.map((tes)=>(
                                            {
                                                close:tes.close,
                                                open:tes.open
                                            }
                                        ))
                                    } >
                                    <Line type="monotone" dot={false} dataKey='close' stroke="#3179F5" strokeWidth={2} />
                                    <Line type="monotone" dot={false} dataKey='open' stroke="green" strokeWidth={2} />
                                </SimpleLineChart>                            
                            </Alert>
                        </Container>
                    </Col>
                    <Col >   
                        <Container>                     
                        <Alert variant={'light'} style={{ width: '100%', height:'15rem' }}>                            
                                <SimpleLineChart data={candleSerie.values.map((tes)=>(
                                            {
                                                low:tes.low,
                                                high:tes.high
                                            }
                                        ))
                                    } >
                                    <Line type="monotone" dot={false} dataKey='low' stroke="#3179F5" strokeWidth={2} />
                                    <Line type="monotone" dot={false} dataKey='high' stroke="purple" strokeWidth={2} />
                                </SimpleLineChart>                            
                            </Alert>
                        </Container>
                    </Col>
                    <Col >   
                        <Container>                     
                            <Alert variant={'light'} style={{ width: '100%', height:'15rem' }}>                            
                                <SimpleBarChart data={candleSerie.values.map((tes)=>(
                                            {
                                                volume:tes.volume
                                            }
                                        ))
                                    } >
                                    <Bar dataKey="volume" fill="#3179F5" activeBar={<Rectangle/>} />
                                </SimpleBarChart>
                            </Alert>
                        </Container>
                    </Col>                     
                </Row>
                <Row>
                    <Col>
                        <CandleSerieViewer candleSerie={candleSerie} chartName={displayName} />
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
