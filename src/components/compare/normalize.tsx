import { LightSerie,LightSerieValue } from '@models/lightserie'


export default function normalizeSeries(existinSeries:LightSerie[],normalize:boolean,shorten:boolean){
    
    const newSeries=Array<LightSerie>()
    
    
    if(shorten){
        if(existinSeries.length>0){

            let maxDate=new Date(existinSeries[0].serie[0]?.time)   

            existinSeries.forEach((lSerie)=>{
                const aux=new Array<LightSerieValue>()

                const cDate=new Date(lSerie.serie[0]?.time)
                
                if(cDate > maxDate){                    
                    maxDate=cDate
                }
        
                lSerie.serie.forEach((val)=>{
                    aux.push({
                        time:val.time,
                        value:val.value
                    })
                })
        
                newSeries.push(
                    {
                        name:lSerie.name,
                        serie:aux,
                        color:lSerie.color,
                        type:lSerie.type
                    }
                )
            })

            newSeries.forEach((s)=>{
                const serie=s
                for (let i = 0; i < s.serie.length; i+=1){
                    const cDate=new Date(s.serie[i].time)
                    if(cDate >= maxDate){
                        serie.serie=s.serie.splice(i)
                        break
                    }
                }
            })

            if(normalize){
                newSeries.forEach((lSerie)=>{
                    const thisSerie=lSerie
                    const nSerie= new Array<LightSerieValue>()
                    thisSerie.serie.forEach((entry)=>{
                        nSerie.push({value:entry.value /thisSerie.serie[0].value,time:entry.time})
                    })
                    thisSerie.serie=nSerie
                })
            }

        }
    }else{
        existinSeries.forEach((lSerie)=>{
            const aux=new Array<LightSerieValue>()

            lSerie.serie.forEach((val)=>{
                aux.push({
                    time:val.time,
                    value:val.value
                })
            })
    
            newSeries.push(
                {
                    name:lSerie.name,
                    serie:aux,
                    color:lSerie.color,
                    type:lSerie.type
                }
            )
        })
    }
    
    return newSeries

}