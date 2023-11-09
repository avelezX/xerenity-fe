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


export default function FunctionsViewer(){
    const [tesList,setTesList] = useState<BanrepSerieValue[]>([])
    
    const [options,setOptions] = useState<BanrepSerie[]>([])
    
    const [viewCanasta, setViewCanasta] = useState('')

    const supabase = createClientComponentClient()
    
	const fetchTesRawData = async (view_canasta:string) => {
		try {
        const res = await fetch(`http://localhost:8000/functions/banrep/${view_canasta}`)
        const data = await res.json()
                    
        if(data){
            setTesList(data as BanrepSerieValue[])
            setViewCanasta(view_canasta)
        }else{
            setTesList([] as BanrepSerieValue[])
        }
		} catch (err) {
			console.log('Ugghhh show message')
		}
	}

    const fetTesData = useCallback( async () =>{
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
    fetTesData()
  },[fetTesData])

    const handleSelect = ( eventKey: string | null) => {        
        if(eventKey){
          fetchTesRawData(`${eventKey}`)  
        }        
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
                    name:'Banrep series',
                     values: tesList.map((ser)=>(
                        {
                          fecha:ser.fecha,
                          value:ser.valor
                        }
                      )
                    )
                  }
                ]
                } chartName={viewCanasta}/>
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
                    <tr key={`row-${tes.fecha}`}>
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