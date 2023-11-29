import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table,Form, Card } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback, ChangeEvent } from "react"
import { BanrepSerieValue,BanrepSerie } from '@models/banrep'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Nav from 'react-bootstrap/Nav'
import DisplaySerie from '@components/compare/CompareSeries'
import { LightSerie,LightSerieValue } from '@models/lightserie'
import CandleSerieViewer from '@components/compare/candleViewer'
import InputGroup from 'react-bootstrap/InputGroup'
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';


export default function SeriesViewer(){
    const [options,setOptions] = useState<BanrepSerie[]>([])    

    const [serieValues,setSerieValues]= useState<LightSerie[]>([])

    const [selectedSeries,setSelectedSeries]= useState<Map<number,LightSerie>>(new Map())

    const [viewCanasta, setViewCanasta] = useState('')

    const [selection,setSelection] = useState<number[]>([])

    const supabase = createClientComponentClient()
    
    const FetchSerieValues = async (idSerie:number) =>{
      let serieValues = Array<LightSerieValue>()
        const {data,error} = await supabase.schema('xerenity').from('banrep_serie_value').select('*').eq('id_serie',idSerie).order('fecha', { ascending: true })

        if(data){
          let avgValues = data as BanrepSerieValue[]
          
          avgValues.forEach((avgval)=>{
            console.log(avgValues[0].valor)
            serieValues.push({
                  value:avgval.valor,
                  time:avgval.fecha.split('T')[0]
              })
          })
          
      }      
      return {serie:serieValues} as LightSerie
    }


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


    const handleCheckboxChange = async (event: ChangeEvent<HTMLInputElement>, checkboxId: number) => {
      let newSelection=new Array<number>()

      if(event.target.checked){
          if(selectedSeries.has(checkboxId)===false){
              selectedSeries.set(checkboxId,await FetchSerieValues(checkboxId))
          }
      }else{
          //Remove this rseries form the list
          selectedSeries.delete(checkboxId)
      }  
      setSelection(newSelection)
    }
    
    return (
        <Container>
            <Row>
              <DropdownButton id="dropdown-item-button" title="Seleccione la serie">
                {                    
                  options.map((serie)=>[
                        <Dropdown.ItemText key={serie.id} >
                            <Form.Check // prettier-ignore
                                type="switch"
                                id={`${serie.id}`}
                                label={serie.nombre}
                                onChange={(e) => handleCheckboxChange(e, serie.id)}
                            />
                        </Dropdown.ItemText>
                    
                  ])
                }
              </DropdownButton>
            </Row>
            <Row>
                <Col>
                    <CandleSerieViewer candleSerie={null} chartName={viewCanasta} otherSeries={Array.from(selectedSeries.values())} fit={true}/>
                </Col>
            </Row>
      </Container>
    )
}