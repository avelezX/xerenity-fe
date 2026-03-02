import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { LightSerieValue } from './lightserie';

export interface WatchlistEntry {
  ticker: string;
  source_name: string;
  display_name: string;
  grupo: string;
  sub_group: string;
  fuente: string;
  entidad: string | null;
  activo: boolean | null;
  tipo_fondo: string | null;
  clase_activo: string | null;
  tamano_fondo: string | null;
  tamano_inversionistas: string | null;
  latest_value: number | null;
  latest_date: string | null;
  change: number | null;
  pct_change: number | null;
}

export interface FicFundEntry {
  codigoNegocio: string;
  fondoName: string;
  entidad: string | null;
  subGroup: string;
  compartimentos: WatchlistEntry[];
  latestDate: string | null;
}

export interface WatchlistGroup {
  name: string;
  entries: WatchlistEntry[];
}

export type TimePeriod =
  | '1D'
  | '5D'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '3Y'
  | '5Y'
  | '10Y';

export const TIME_PERIODS: TimePeriod[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  '3Y',
  '5Y',
  '10Y',
];

export interface DashboardConfig {
  title: string;
  icon: IconDefinition;
  filters: {
    grupos?: string[];
    fuentes?: string[];
    subGroups?: string[];
  };
  groupByField: 'grupo' | 'sub_group' | 'fuente' | 'entidad';
  leftPanelGroups?: string[];
  rightPanelGroups?: string[];
  defaultChartTickers?: string[];
  defaultPeriod?: TimePeriod;
  showNormalize?: boolean;
  showEntidadFilter?: boolean;
  showActivoFilter?: boolean;
  showTipoFondoFilter?: boolean;
  showClaseActivoFilter?: boolean;
  showTamanoFondoFilter?: boolean;
  showTamanoInversionistasFilter?: boolean;
  showCurrencyPairSelector?: boolean;
  infoPath?: string;
  ficHierarchical?: boolean;
}

export interface ChartSelection {
  ticker: string;
  display_name: string;
  color: string;
  fullData: LightSerieValue[];
  data: LightSerieValue[];
}
