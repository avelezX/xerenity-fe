export interface LightSerieValue{
    value:number;
    time:string;
}

export interface LightSerieEntry{
    description:string;
    source_name:string;
    display_name:string;
    grupo:string;
}

export interface LightSerie{
    
    serie:LightSerieValue[]
}
