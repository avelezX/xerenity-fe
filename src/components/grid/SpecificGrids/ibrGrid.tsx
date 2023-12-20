'use client'

import React,{ useState,useEffect,useCallback,ChangeEvent } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { GridEntry } from '@models/tes'
import CandleGridViewer from '../CandleGrid'

export interface CopTesGridProps{
    selectCallback:(eventKey: ChangeEvent<HTMLFormElement>)=> void;
}

export default function IbrTesGrid({selectCallback}:CopTesGridProps){
    const supabase = createClientComponentClient()

    const [gridEntries,setGridEntries] = useState<GridEntry[]>([])

    const fetchTesNames = useCallback( async () =>{
        const {data,error} =   await supabase.schema('xerenity').rpc('get_ibr_grid_raw',{})

        if(error){
            setGridEntries([])
        }

        if(data){

            setGridEntries(data as GridEntry[])
        }else{
            setGridEntries([] as GridEntry[])
        }
        
    },[supabase])

    useEffect(()=>{
        fetchTesNames()
    },[fetchTesNames])
    
    return (        
        <CandleGridViewer allTes={gridEntries} selectCallback={selectCallback} />
    )
}
