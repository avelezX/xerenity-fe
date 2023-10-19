export interface CanastaRaw {
    id_canasta: number;
    fecha: string;
    valorcontribucion: number;
    indice: number;
    valor: number;
    valormensual:number;
}

export interface Canasta {
    id: number;
    nombre: string;
}


export interface CanastaInflacion {
    fecha: string;
    indice: number;
    percentage_change:number;
}