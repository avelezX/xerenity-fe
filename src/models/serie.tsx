export interface SerieValue{
    fecha:string,
    value:number
}

export interface Serie{
    name:string,
    values:SerieValue[]
}
