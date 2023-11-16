export interface SerieValue{
    fecha:string;
    value:number;
}

export interface Serie{
    name:string;
    values:SerieValue[];
}

export interface GenericSerie {
    id:string;
    nombre:string;
}
