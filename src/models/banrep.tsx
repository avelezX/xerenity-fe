export interface BanrepSerieValue {
    id_serie: number;
    fecha: string;
    valor: number;
}

export interface SerieNameValue{
    name:string;
    serieValue:BanrepSerieValue[]
}


export interface BanrepSerie {
    id: number;
    nombre: string;
    descripcion: string;
    fuente: string;
}