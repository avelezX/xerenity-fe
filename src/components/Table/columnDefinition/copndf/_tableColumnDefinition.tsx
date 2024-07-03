import { CopNdf } from '@models/condf';
import currencyFormat from 'src/utils/currencyFormat';

const NdfColumns = [
  {
    name: 'Plazo (dias)',
    selector: (row: CopNdf) => row.days_diff_effective_expiration,
    sortable: true,
  },
  {
    name: '# Operaciones',
    selector: (row: CopNdf) => row.trade_count,
    sortable: true,
  },
  {
    name: 'Volumen (USD)',
    selector: (row: CopNdf) => currencyFormat(row.total_sum_notional_leg_2),
    sortable: true,
  },
  {
    name: 'Promedio',
    selector: (row: CopNdf) => currencyFormat(row.average_exchange_rate),
    sortable: true,
  },
  {
    name: 'Minimo',
    selector: (row: CopNdf) => currencyFormat(row.min_exchange_rate),
    sortable: true,
  },
  {
    name: 'Mediana',
    selector: (row: CopNdf) => currencyFormat(row.median_exchange_rate),
    sortable: true,
  },
  {
    name: 'Maximo',
    selector: (row: CopNdf) => currencyFormat(row.max_exchange_rate),
    sortable: true,
  },
  {
    name: 'Ultimo',
    selector: (row: CopNdf) => currencyFormat(row.last_exchange_rate),
    sortable: true,
  },
  {
    name: 'Fecha/Hora ultimo',
    selector: (row: CopNdf) => row.last_trade_time,
    sortable: true,
  },
  {
    name: 'Ultimo volumen',
    selector: (row: CopNdf) => row.last_volume,
    sortable: true,
  },
];

export default NdfColumns;
