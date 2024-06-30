import currencyFormat from 'src/utils/currencyFormat';
import { GridEntry } from '@models/tes';

const GridColumns = [
  {
    name: 'Nombre',
    selector: (row: GridEntry) => row.displayname,
    sortable: true,
  },
  {
    name: 'Fecha/Hora',
    selector: (row: GridEntry) => row.operation_time,
    sortable: true,
  },
  {
    name: 'Last',
    selector: (row: GridEntry) => row.close.toFixed(2),
    sortable: true,
  },
  {
    name: 'Prev',
    selector: (row: GridEntry) => row.prev.toFixed(2),
    sortable: true,
  },
  {
    name: 'Open',
    selector: (row: GridEntry) => row.open.toFixed(2),
    sortable: true,
  },
  {
    name: 'Low',
    selector: (row: GridEntry) => row.low.toFixed(2),
    sortable: true,
  },
  {
    name: 'High',
    selector: (row: GridEntry) => row.high.toFixed(2),
    sortable: true,
  },
  {
    name: 'Volume',
    selector: (row: GridEntry) => currencyFormat(row.volume),
    sortable: true,
  },
];

export default GridColumns;
