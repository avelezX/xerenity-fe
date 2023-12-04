import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  Table,
  Card, 
  Button,
  Stack,
  ListGroup,
  Offcanvas,
  Alert,
  Spinner,
  Row,
  Col,
  Container,
  Badge
} from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import { LightSerie,LightSerieValue,LightSerieEntry,LightSerieValueArray } from '@models/lightserie'
import CandleSerieViewer from '@components/compare/candleViewer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClose,
  faDownLong,
  faList
} from '@fortawesome/free-solid-svg-icons'
import SeriePicker from '@components/serie/SeriePicker'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'

export default function SeriesViewer(){

    const [loadingSerie,setLowdingSerie]= useState(false)

    const [showCanvas, setShowCanvas] = useState(false)

    const [selectedSeries,setSelectedSeries]= useState<Map<string,LightSerie>>(new Map())

    const [selectionOptions,setSelectionOptions]= useState<Map<string,LightSerieEntry[]>>(new Map())

    const [serieNameInfo,setSerieNameInfo]= useState<Map<string,LightSerieEntry>>(new Map())

    const supabase = createClientComponentClient()

    const handleCloseCanvas = () => setShowCanvas(false)

    const handleShowCanvas = () => setShowCanvas(true)
    
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
        <Container>
            <div>
              <Offcanvas show={showCanvas} onHide={handleCloseCanvas} placement='end'>
                <Offcanvas.Header closeButton>
                  <Offcanvas.Title>
                    <Row>
                      <Col>
                        Series
                      </Col>
                      <Col>
                        {
                          loadingSerie?
                          (
                            <Spinner animation="border" />
                          ):
                          (
                            null
                          )
                        }
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
              </Offcanvas>    
              </div>
            <Row>            
                <Col>
                  <Alert variant="secondary">
                    <Row>
                      <Col sm={3}>
                        <Button onClick={handleShowCanvas}>
                        <Stack direction='horizontal' gap={1}>                            
                            <Badge bg="secondary"><FontAwesomeIcon size="xs" icon={faList} /></Badge>
                            Seleccionar serie
                          </Stack>
                        </Button>
                      </Col>

                      <Col sm={3}>
                        <Button onClick={downloadSeries}>
                          <Stack direction='horizontal' gap={1}>                            
                            <Badge bg="secondary"><FontAwesomeIcon size="xs" icon={faDownLong} /></Badge>
                            Descargar
                          </Stack>
                        </Button>
                      </Col>                      
                    </Row>                      
                  </Alert>                
                </Col>          
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer candleSerie={null} chartName='' otherSeries={Array.from(selectedSeries.values())} fit/>
                </Col>
            </Row>
            <Row>
              <Col>
                <Table bordered hover>
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
                              <Button variant="outline-primary" >
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