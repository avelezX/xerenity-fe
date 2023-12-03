import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table,Row,Col,NavDropdown,Nav,Container } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import {Tes,TesYields,CandleSerie} from '@models/tes'
import CandleSerieViewer from '@components/compare/candleViewer'


export default function TesViever(){
    
    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:'',values:[]})
    
    const [options,setOptions] = useState<Tes[]>([])

    const supabase = createClientComponentClient()
    
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

    const fetchTesData = useCallback( async () =>{
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

  useEffect(()=>{
    fetchTesData()
  },[fetchTesData])

    const handleSelect = (eventKey: ChangeEvent<HTMLSelectElement>) => {        
        fetchTesRawData(`${eventKey}`)
    }

    
    return (
        <Container>
            <Row>
              <Nav variant="pills" activeKey="1" onSelect={()=>handleSelect}>
                <NavDropdown title="Seleccionar Tes" id="nav-dropdown">
                  {options.map((option) => (                    
                    <NavDropdown.Item  key={`drop-down-name${option.name}`} eventKey={option.name} >{option.name}</NavDropdown.Item>
                  ))}
                </NavDropdown>
              </Nav>
            </Row>
          <Row>
            <Col>
              <CandleSerieViewer candleSerie={candleSerie} chartName={candleSerie.name} otherSeries={[]} fit/>
            </Col>
          </Row>
          <Row>
            <Col>
            <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>low</th>
                    <th>Close</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {candleSerie.values.map((tes) => (
                    <tr key={`tr-day-name${tes.day}`}>
                      <td>{tes.day}</td>
                      <td>{tes.open.toPrecision(2)}</td>
                      <td>{tes.high}</td>
                      <td>{tes.low}</td>
                      <td>{tes.close}</td>
                      <td>
                        {tes.volume}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    )
}
