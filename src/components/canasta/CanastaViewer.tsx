import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback } from "react"
import { CanastaRaw,Canasta } from '@models/canasta'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'


export default function CanastaViewer(){
    const [tesList,setTesList] = useState<CanastaRaw[]>([])
    
    const [options,setOptions] = useState<Canasta[]>([])
    
    const [viewCanasta, setViewCanasta] = useState('')
    

    const supabase = createClientComponentClient()
    
    const fetchTesRawData = useCallback( async (view_canasta:string) =>{
        const {data,error} =   await supabase.schema('xerenity').from('canasta_values').select().eq('id_canasta',view_canasta).order('fecha', { ascending: false })
        
        if(error){            
            setTesList([])
        }

        if(data){
            setTesList(data as CanastaRaw[])
            setViewCanasta(view_canasta)
        }else{
            setTesList([] as CanastaRaw[])
        }

    },[supabase])

    const fetchTesData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('canasta').select()
      
      if(error){          
          setOptions([])
      }

      if(data){
        setOptions(data as Canasta[])
      }else{
        setOptions([] as Canasta[])
      }

  },[supabase])

  useEffect(()=>{
    fetchTesData()
  },[fetchTesData])

    const handleSelect = (eventKey: string|null) => {        
        fetchTesRawData(`${eventKey}`)
    }

    
    return (
        <Container>
            <Row>
              <Nav variant="pills" activeKey="1" onSelect={handleSelect}>
                <NavDropdown title="Seleccionar Canasta" id="nav-dropdown">
                  {options.map((option) => (                    
                    <NavDropdown.Item key={`drop-down${option.id}`} eventKey={option.id} >{option.nombre}</NavDropdown.Item>
                  ))}                  
                </NavDropdown>
              </Nav>             
            </Row>
          <Row>
            <Col>

            </Col>
          </Row>
          <Row>
            <Col>
            <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Contribucion</th>
                    <th>Indice</th>
                    <th>Valor</th>
                    <th>Mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {tesList.map((tes) => (
                    <tr key={`tr-tes-${tes.indice}`}>
                      <td>{tes.fecha}</td>
                      <td>{tes.valorcontribucion}</td>
                      <td>{tes.indice}</td>
                      <td>{tes.valor}</td>
                      <td>{tes.valormensual}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
      </Container>
    )
}