import React from 'react';
import currencyFormat from 'src/utils/currencyFormat';
import { GridEntry } from 'src/types/tes';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const SUCCESS_COLOR = designSystem['green-500'].value;
const DANGER_COLOR = designSystem['red-600'].value;

function ChangeBadge({ row }: { row: GridEntry }) {
  const bps = (row.close - row.prev) * 100;
  const sign = bps > 0 ? '+' : '';
  let color = '#666';
  if (bps < 0) color = SUCCESS_COLOR;
  else if (bps > 0) color = DANGER_COLOR;
  return React.createElement(
    'span',
    {
      style: {
        color,
        fontWeight: 600,
        fontSize: '13px',
      },
    },
    `${sign}${bps.toFixed(1)} bps`
  );
}

function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

const GridColumns = [
  {
    name: 'Nombre',
    selector: (row: GridEntry) => row.displayname,
    sortable: true,
    width: '220px',
  },
  {
    name: 'Cambio',
    selector: (row: GridEntry) => (row.close - row.prev) * 100,
    sortable: true,
    cell: (row: GridEntry) => React.createElement(ChangeBadge, { row }),
    width: '110px',
    right: true,
  },
  {
    name: 'Fecha/Hora',
    selector: (row: GridEntry) => row.operation_time,
    cell: (row: GridEntry) => formatDateTime(row.operation_time),
    sortable: true,
    width: '130px',
  },
  {
    name: 'Last',
    selector: (row: GridEntry) => row.close.toFixed(2),
    sortable: true,
    width: '80px',
    right: true,
  },
  {
    name: 'Prev',
    selector: (row: GridEntry) => row.prev.toFixed(2),
    sortable: true,
    width: '80px',
    right: true,
  },
  {
    name: 'Open',
    selector: (row: GridEntry) => row.open.toFixed(2),
    sortable: true,
    width: '80px',
    right: true,
  },
  {
    name: 'Low',
    selector: (row: GridEntry) => row.low.toFixed(2),
    sortable: true,
    width: '80px',
    right: true,
  },
  {
    name: 'High',
    selector: (row: GridEntry) => row.high.toFixed(2),
    sortable: true,
    width: '80px',
    right: true,
  },
  {
    name: 'Volumen',
    selector: (row: GridEntry) => currencyFormat(row.volume),
    sortable: true,
    width: '130px',
    right: true,
  },
];

export default GridColumns;
