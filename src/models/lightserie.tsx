export interface LightSerieValue{
    value:number;
    time:string;
}

export function LightSerieValueArray(entry:LightSerieValue){
    return [entry.time.toString(),entry.value.toFixed(2).toString()]
}

export interface LightSerieEntry{
    description:string;
    source_name:string;
    display_name:string;
    grupo:string;
    fuente:string;
}

export interface LightSerie{
    
    name:string;
    color:string;
    serie:LightSerieValue[];
}
