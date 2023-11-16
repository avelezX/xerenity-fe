import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import { BanrepSerieValue,BanrepSerie } from '@models/banrep'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'
import DisplaySerie from '@components/compare/CompareSeries'

export default function SeriesViewer(){
    const [tesList,setTesList] = useState<BanrepSerieValue[]>([])
    
    const [options,setOptions] = useState<BanrepSerie[]>([])
    
    const [viewCanasta, setViewCanasta] = useState('')    

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async (view_canasta:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from('banrep_serie_value').select('*').eq('id_serie',view_canasta).order('fecha', { ascending: false })
        
        if(error){            
            setTesList([])
        }

        if(data){
            setTesList(data as BanrepSerieValue[])
            setViewCanasta(view_canasta)
        }else{
            setTesList([] as BanrepSerieValue[])
        }

    },[supabase])

    const fetchData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('banrep_serie').select()
      
      if(error){
          setOptions([])
      }

      if(data){
        setOptions(data as BanrepSerie[])
      }else{
        setOptions([] as BanrepSerie[])
      }

  },[supabase])

  useEffect(()=>{
    fetchData()
  },[fetchData])

    const handleSelect = (eventKey: any) => {        
        fetchTesRawData(`${eventKey}`)
    }

    
    return (
        <Container>
            <Row>
              <Nav variant="pills" activeKey="1" onSelect={handleSelect}>
                  <NavDropdown title="Seleccionar Canasta" id="nav-dropdown">
                    {options.map((option) => (                    
                      <NavDropdown.Item key={option.id} eventKey={option.id} >{option.nombre}</NavDropdown.Item>
                    ))}                  
                  </NavDropdown>
              </Nav>
            </Row>
            <Row>
              <DisplaySerie allSeries={
                [
                  {
                      name:'Inflacion existente',
                      values: tesList.map((ser)=>(
                        {
                          fecha:ser.fecha,
                          value:ser.valor
                        }
                      )
                    )
                  }
                ]
                } 
                chartName={viewCanasta}
                chartType='area'
                />
          </Row>
          {' '}
          <Row>
            <Col>
            <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {tesList.map((tes) => (
                    <tr key={`tr-${tes.fecha}`}>
                      <td>{tes.fecha}</td>
                      <td>{tes.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    )
}