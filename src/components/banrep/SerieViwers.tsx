import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table,Form, Card, Button, Stack } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import { LightSerie,LightSerieValue,LightSerieEntry } from '@models/lightserie'
import CandleSerieViewer from '@components/compare/candleViewer'
import Offcanvas from 'react-bootstrap/Offcanvas';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Alert from 'react-bootstrap/Alert';



export default function SeriesViewer(){

    const [loadingSerie,setLowdingSerie]= useState(false)

    const [showCanvas, setShowCanvas] = useState(false);

    const [selectedSeries,setSelectedSeries]= useState<Map<string,LightSerie>>(new Map())

    const [selectionOptions,setSelectionOptions]= useState<Map<string,LightSerieEntry[]>>(new Map())

    const [_selection,setSelection] = useState<string[]>([])

    const supabase = createClientComponentClient()

    const handleCloseCanvas = () => setShowCanvas(false);

    const handleShowCanvas = () => setShowCanvas(true);
    
    const FetchSerieValues = async (idSerie:string) =>{
      setLowdingSerie(true)
      const {data,error} = await await supabase.schema('xerenity').rpc('search',{name:idSerie})
      setLowdingSerie(false)
      if(data){
        let allValues=data.data as LightSerieValue[]        
        return {serie:allValues} as LightSerie     
      }
            
      return {serie:[]} as LightSerie
    }


    const fetchData = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').from('search').select()
      
      if(error){
        setSelectionOptions(new Map())
      }

      if(data){
        let options = data as LightSerieEntry[]
        let mapOptions= new Map<string,LightSerieEntry[]>()

        options.forEach((entry)=>{
          
          if(mapOptions.has(entry.grupo)){
              mapOptions.get(entry.grupo)!.push(entry)
          }else{
              mapOptions.set(entry.grupo,[entry])
          }
        })

        setSelectionOptions(mapOptions)
      }else{
        setSelectionOptions(new Map())
      }

  },[supabase])

    useEffect(()=>{
      fetchData()
    },[fetchData])


    const handleCheckboxChange = useCallback(async (event: ChangeEvent<HTMLInputElement>, checkboxId: string) => {
      let newSelection=new Array<string>()

      if(event.target.checked){
        selectedSeries.set(checkboxId,await FetchSerieValues(checkboxId)) 
      }else{
        //Remove this rseries form the list
        selectedSeries.delete(checkboxId)
      }  
      
      setSelection(newSelection)
    },[selectedSeries])
    
    return (
        <Container>
            <div>
              <Offcanvas show={showCanvas} onHide={handleCloseCanvas} placement={'end'}>
                <Offcanvas.Header closeButton>
                  <Offcanvas.Title>
                    Serie                    
                  </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <Stack gap={2} >
                      {                    
                        
                        Array.from(selectionOptions.entries()).map(([key,value])=>[
                          <Card border="primary" key={`card-${key}`}>                          
                          <Card.Header as="h5">{key}</Card.Header>
                          <Card.Body>                            
                              {
                                   value.map((serie)=>[                              
                                    <Form.Check // prettier-ignore
                                        type="switch"
                                        id={`${serie.source_name}`}
                                        label={serie.display_name}
                                        disabled={loadingSerie}
                                        checked={selectedSeries.has(serie.source_name)}
                                        onChange={(e) => handleCheckboxChange(e, serie.source_name)}
                                    />                            
                                  ])
                                }  
                            <Card.Text>
                              <Stack>                             
                              </Stack>
                            </Card.Text>                            
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
                      <Col>
                        <Button onClick={handleShowCanvas}>
                          Seleccionar series
                        </Button>
                      </Col>
                    </Row>                      
                  </Alert>                
                </Col>          
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer candleSerie={null} chartName={''} otherSeries={Array.from(selectedSeries.values())} fit={true}/>
                </Col>
            </Row>
      </Container>
    )
}