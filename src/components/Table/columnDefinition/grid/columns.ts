import currencyFormat from 'src/utils/currencyFormat';
import { GridEntry } from 'src/types/tes';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const SUCCESS_COLOR = designSystem['green-500'].value;
const DANGER_COLOR = designSystem['red-600'].value;
const WHITE_COLOR = designSystem['white-100'].value;

const conditionalColChnageStyles = [
  {
    when: (row: GridEntry) => row.close < row.prev,
    style: {
      backgroundColor: SUCCESS_COLOR,
      color: WHITE_COLOR,
      '&:hover': {
        cursor: 'pointer',
      },
    },
  },
  {
    when: (row: GridEntry) => row.close > row.prev,
    style: {
      backgroundColor: DANGER_COLOR,
      color: WHITE_COLOR,
      '&:hover': {
        cursor: 'pointer',
      },
    },
  },
];

const GridColumns = [
  {
    name: 'Nombre',
    selector: (row: GridEntry) => row.displayname,
    sortable: true,
  },
  {
    name: 'Chnage',
    selector: (row: GridEntry) => row.operation_time,
    sortable: true,
    conditionalCellStyles: conditionalColChnageStyles,
    cell: (row: GridEntry) => ((row.prev - row.close) * 100 * -1).toFixed(1),
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
