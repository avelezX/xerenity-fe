export interface USTYieldPoint {
  fecha: string;
  tenor_months: number;
  yield_value: number;
  curve_type: 'NOMINAL' | 'TIPS';
}

export interface SOFRSwapPoint {
  fecha: string;
  tenor_months: number;
  swap_rate: number;
}

export interface USReferenceRate {
  fecha: string;
  rate_type: string;
  rate: number;
  volume_billions: number | null;
  target_from: number | null;
  target_to: number | null;
}
