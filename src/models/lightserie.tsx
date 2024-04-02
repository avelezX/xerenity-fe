import { BarPrice } from 'lightweight-charts';

export interface LightSerieValue {
  value: number;
  time: string;
}

export function LightSerieValueArray(entry: LightSerieValue) {
  return [entry.time.toString(), entry.value.toFixed(2).toString()];
}

export interface LightSerieEntry {
  description: string;
  source_name: string;
  display_name: string;
  grupo: string;
  fuente: string;
  sub_group: string;
}

export interface PriceFormat {
  type: 'percent' | 'price' | 'volume' | 'custom';
  precision: number;
  minMove: number;
}

export interface CustomFormat {
  type: 'custom';
  formatter: (priceValue: BarPrice) => string;
}

export interface LightSerie {
  name: string;
  color: string;
  serie: LightSerieValue[];
  type: 'bar' | 'line';
  priceFormat: PriceFormat | CustomFormat;
  axisName?:'left'| 'right' | string;
}

export const defaultPriceFormat: PriceFormat = {
  type: 'price',
  precision: 0,
  minMove: 0.01,
};

export const defaultCustomFormat: CustomFormat = {
  type: 'custom',
  formatter: (priceValue: BarPrice) => priceValue.toLocaleString(),
};
