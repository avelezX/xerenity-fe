export interface ConsumerPriceRaw {
  id_canasta: number;
  fecha: string;
  valorcontribucion: number;
  indice: number;
  valor: number;
  valormensual: number;
}

export interface ConsumerPrice {
  id: number;
  nombre: string;
}

export interface ConsumerPriceInflacion {
  fecha: string;
  indice: number;
  percentage_change: number;
}
