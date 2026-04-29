export interface CPIPoint {
  time: string;
  indice: number;
  mom: number | null;
  yoy: number | null;
  ytd: number | null;
}

export interface CPISnapshot {
  last_date: string | null;
  last_indice: number | null;
  last_mom: number | null;
  last_yoy: number | null;
  last_ytd: number | null;
  prev_yoy: number | null;
  prev_mom: number | null;
}

export interface CPIContribution {
  time: string;
  id_canasta: number;
  nombre: string;
  valorcontribucion: number;
  valormensual: number;
}

export interface InflationCanasta {
  id: number;
  nombre: string;
  peso: number;
}

export type InflationView = 'yoy' | 'mom' | 'ytd' | 'indice';
