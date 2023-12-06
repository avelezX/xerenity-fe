import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  Table,
  Card, 
  Button,
  Stack,
  ListGroup,
  Offcanvas,
  Spinner,
  Row,
  Col,
  Container,
  Navbar
} from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import { LightSerie,LightSerieValue,LightSerieEntry,LightSerieValueArray } from '@models/lightserie'
import CandleSerieViewer from '@components/compare/candleViewer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClose,
  faFileCsv
} from '@fortawesome/free-solid-svg-icons'
import SeriePicker from '@components/serie/SeriePicker'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'


export default function SeriesViewer(){

    const [loadingSerie,setLowdingSerie]= useState(false)

    const [selectedSeries,setSelectedSeries]= useState<Map<string,LightSerie>>(new Map())

    const [selectionOptions,setSelectionOptions]= useState<Map<string,LightSerieEntry[]>>(new Map())

    const [serieNameInfo,setSerieNameInfo]= useState<Map<string,LightSerieEntry>>(new Map())

    const supabase = createClientComponentClient()

    
    const FetchSerieValues = async (idSerie:string,newColor:string) =>{
     
      const {data,error} = await await supabase.schema('xerenity').rpc('search',{name:idSerie})
      
      if(error){
        return {serie:[],color:'',name:''} as LightSerie
      }
      if(data){        
        return {
          serie:data.data as LightSerieValue[],
          color:newColor,
          name:serieNameInfo.get(idSerie)?.display_name
        } as LightSerie     
      }
            
      return {serie:[],color:'',name:''} as LightSerie
    }

    const fetchData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('search').select()
      
      if(error){
        setSelectionOptions(new Map())
      }

      if(data){
        const options = data as LightSerieEntry[]
        const mapOptions= new Map<string,LightSerieEntry[]>()

        const serieData= new Map<string,LightSerieEntry>()

        options.forEach((entry)=>{
          serieData.set(entry.source_name,entry)
          if(mapOptions.has(entry.grupo)){
              mapOptions.get(entry.grupo)?.push(entry)
          }else{
              mapOptions.set(entry.grupo,[entry])
          }
        })

        setSelectionOptions(mapOptions)
        setSerieNameInfo(serieData)
      }else{
        setSelectionOptions(new Map())
      }

  },[supabase])

    useEffect(()=>{
      fetchData()
    },[fetchData])


    const handleCheckboxChange = useCallback(async (event: ChangeEvent<HTMLInputElement>, checkboxId: string,color:string) => {
      
      setLowdingSerie(true)

      const newSelection=new Map<string,LightSerie>()
      
      Array.from(selectedSeries.entries()).forEach(([key,value])=>{
        newSelection.set(key,value)
      })
      if(event.target.checked){
        newSelection.set(checkboxId,await FetchSerieValues(checkboxId,color)) 
      }else{        
        newSelection.delete(checkboxId)
      }

      setSelectedSeries(newSelection)

      setLowdingSerie(false)
      
    },[selectedSeries,setSelectedSeries,FetchSerieValues])
    
    const handleColorChnage = useCallback(async ( checkboxId: string,newColor:string) => {        
      const newSelection=new Map<string,LightSerie>()
      
      Array.from(selectedSeries.entries()).forEach(([key,value])=>{        
        if(key===checkboxId){          
          newSelection.set(key,{serie:value.serie,color:newColor,name:value.name})
        }else{
          newSelection.set(key,value)
        }
      })      

      setSelectedSeries(newSelection)      
      
    },[selectedSeries])

    const handleRemoveSerie = useCallback(async ( serieId: string) => {
      const newSelection=new Map<string,LightSerie>()
      
      Array.from(selectedSeries.entries()).forEach(([key,value])=>{
        
        newSelection.set(key,value)
      })

      newSelection.delete(serieId)

      setSelectedSeries(newSelection)
    },[selectedSeries])

    const downloadSeries = () => {                
      const allValues: string[][]=[]
      allValues.push([
          'serie',
          'time',
          'value'
      ]
      )
      
      Array.from(selectedSeries.values()).forEach((value)=>{
        value.serie.forEach((entry)=>{
          allValues.push([
            value.name
          ].concat(LightSerieValueArray(entry)))
          
        })        
      })

      const csv=ExportToCsv(allValues)

      downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;')
  }  

    return (
        <Container fluid>
            <Row>              
                <Navbar  expand={false} className="bg-body-tertiary mb-3">
                  <Container fluid>
                    <Navbar.Brand >
                      <Button variant="outline-primary" onClick={downloadSeries}>Exportar CSV <FontAwesomeIcon size="xs" icon={faFileCsv} /></Button>
                    </Navbar.Brand>
                    <Navbar.Toggle style={{background:'#D3D3D3'}} aria-controls='offcanvasNavbar-expand-false' />

                    <Navbar.Offcanvas
                      id='offcanvasNavbar-expand-false'
                      aria-labelledby='offcanvasNavbarLabel-expand-false'
                      placement="end"
                    >
                      <Offcanvas.Header closeButton>
                        <Offcanvas.Title id='offcanvasNavbarLabel-expand-false'>
                        <Row>
                            <Col>
                              Series
                            </Col>
                            <Col>
                              {loadingSerie?(<Spinner animation="border" />):(null)}
                            </Col>
                          </Row> 
                        </Offcanvas.Title>
                      </Offcanvas.Header>
                      <Offcanvas.Body>
                          <Stack gap={3} >
                          { 
                            Array.from(selectionOptions.entries()).map(([key,value])=>[
                              <Card border="primary" key={`card-${key}`}>                          
                              <Card.Header as="h5">{key}</Card.Header>
                              <Card.Body>
                                <Stack gap={2}>                            
                                  {
                                      value.map((serie)=>[      
                                        
                                          <SeriePicker key={`serie-${serie.source_name}`}
                                            handleSeriePick={handleCheckboxChange} 
                                            handleColorPicker={handleColorChnage}
                                            displayName={serie.display_name} 
                                            serieID={serie.source_name} 
                                            disable={loadingSerie} 
                                            checked={selectedSeries.has(serie.source_name)}
                                          />
                                        
                                      ])
                                    }
                                  </Stack>                         
                              </Card.Body>
                            </Card>                            
                            ])
                          }
                        </Stack>                       
                      </Offcanvas.Body>
                    </Navbar.Offcanvas>
                  </Container>
                </Navbar>       
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer candleSerie={null} chartName='' otherSeries={Array.from(selectedSeries.values())} fit/>
                </Col>
            </Row>
            <Row>
              <Col>
                <Table bordered hover responsive='sm'>
                  <thead>
                    <tr>                      
                      <th>Nombre</th>
                      <th>Descripcion</th>
                      <th>Fuente</th>
                      <th style={{width:'2%'}}> Quitar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      Array.from(serieNameInfo.entries()).map(([key,value])=>[
                        selectedSeries.has(key)?
                        (
                          <tr key={`t-row-serie${key}`}>
                            <td>
                              <ListGroup >
                                    <ListGroup.Item  style={{backgroundColor:selectedSeries.get(key)?.color}}>{value.display_name}</ListGroup.Item>
                              </ListGroup>
                            </td>
                            <td>{value.description}</td>
                            <td>{value.fuente}</td>
                            <td>
                              <Button aria-label="descargar" variant="outline-primary" >
                                <FontAwesomeIcon size="xs" icon={faClose} onClick={()=>handleRemoveSerie(value.source_name)} />
                              </Button>
                            </td>
                          </tr>                          
                        ):
                        (
                          null
                        )
                      ])
                    }
                  </tbody>
                </Table>
              </Col>
            </Row>
      </Container>
    )
}