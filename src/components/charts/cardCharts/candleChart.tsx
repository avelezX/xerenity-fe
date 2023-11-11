import Container from 'react-bootstrap/Container'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import React,{ useState, useEffect, useCallback } from "react"
import {TesYields,CandleSerie } from '@models/tes'
import Toast from 'react-bootstrap/Toast'
import ToastContainer from 'react-bootstrap/ToastContainer'
import CandleSerieViewer from '@components/compare/candleViewer'

type ViewerProps={    
    tableName:string;
}

export default function CardCandleSeries({tableName}:ViewerProps){

    const supabase = createClientComponentClient()

    const [candleSerie,setCandleSerie]= useState<CandleSerie>({name:tableName,values:[]})  

    const fetchTesRawData = useCallback( async (view_tes:string) =>{               
        const {data,error} =   await supabase.schema('xerenity').from(view_tes).select("*").order('day', { ascending: false })
            
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
        fetchTesRawData(tableName)
    },[fetchTesRawData,tableName])

    return (
        <Container>
            <ToastContainer className="position-static" >
                <Toast>
                    <Toast.Header closeButton={false} style={{textAlign: 'center'}} >                    
                    <strong className="me-auto" >{tableName}</strong>                    
                    </Toast.Header>
                    <Toast.Body>
                        <CandleSerieViewer  candleSerie={candleSerie} chartName='' chartHeight={450} />
                    </Toast.Body>
                </Toast>
            </ToastContainer>
        </Container>
    )
}