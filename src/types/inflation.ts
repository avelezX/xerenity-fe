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
  id_padre?: number | null;
  nivel?: 0 | 1 | 2; // 0=Total, 1=división, 2=subgrupo
}

export interface CityCPIPoint {
  time: string;
  indice: number;
  mom: number | null;
  yoy: number | null;
}

export interface CitySnapshot {
  ciudad: string;
  fecha: string;
  indice: number;
  mom: number | null;
  yoy: number | null;
}

export interface CoreInflationSeries {
  id: number;
  nombre: string;
  values: { time: string; value: number }[];
}

export type InflationView = 'yoy' | 'mom' | 'ytd' | 'indice';
