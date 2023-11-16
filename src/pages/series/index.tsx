import { AdminLayout } from '@layout'
import Navbar from 'react-bootstrap/Navbar'
import {Col, Container, Row} from 'react-bootstrap'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import React,{ useState, useEffect,ChangeEvent,useCallback } from "react"
import { BanrepSerieValue,BanrepSerie,SerieNameValue } from '@models/banrep'
import DisplaySerie from '@components/compare/CompareSeries'
import { Serie,SerieValue } from '@models/serie'
import SeriesColPicker from '@components/compare/series/seriesColPicker'

interface TopTes{
  tes:string;
  date_trunc:string;
  operations: number;
}

export default function SeriesVisualizerHomePage(){
    const supabase = createClientComponentClient()

    const [selection,setSelection] = useState<number[]>([])

    const [seriesValues,setSeriesValues] = useState<Serie[]>([])


    const FetchSerieValues = useEffect( () =>{
        let newSeries=new Array<Serie>()

        selection.forEach( async (idSerie)=>{
            const {data,error} =   await supabase.schema('xerenity').from('banrep_serie_value').select('*').eq('id_serie',idSerie).order('fecha', { ascending: false })
            if(data){
                let allData=data as BanrepSerieValue[]
                let values=new Array<SerieValue>()

                allData.forEach((point)=>{
                    values.push({fecha:point.fecha,value:point.valor} as SerieValue)
                })
                
                newSeries.push({values:values,name:`${idSerie}`} as Serie)
            }
            
        })
        
        setSeriesValues(newSeries)

    },[supabase,selection])

    const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>, checkboxId: number) => {
        let newSelection=new Array<number>()

        if(event.target.checked){
            //Add this series to the list
            newSelection = [...selection, checkboxId];
        }else{
            //Remove this rseries form the list
            newSelection= selection.filter(id => id !== checkboxId)            
        }
        
        setSelection(newSelection)
    }


  return (
    <AdminLayout>
      <Container fluid> 
        <Row>
            <Col sm={2}>
                <SeriesColPicker selectCallback={handleCheckboxChange}/>
            </Col>
            <Col sm={10}>
                <DisplaySerie 
                    allSeries={seriesValues} 
                    chartName={'Comparisson'} 
                    chartType='area'
                />
            </Col>
        </Row>       
      </Container>
    </AdminLayout>
  )
}