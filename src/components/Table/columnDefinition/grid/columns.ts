import React from 'react';
import currencyFormat from 'src/utils/currencyFormat';
import { GridEntry } from 'src/types/tes';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const SUCCESS_COLOR = designSystem['green-500'].value;
const DANGER_COLOR = designSystem['red-600'].value;

function getArrow(bps: number): string {
  if (bps > 0) return '▲';
  if (bps < 0) return '▼';
  return '—';
}

function ChangeBadge({ row }: { row: GridEntry }) {
  const bps = (row.close - row.prev) * 100;
  const sign = bps > 0 ? '+' : '';
  const arrow = getArrow(bps);
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
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
      },
    },
    `${arrow} ${sign}${bps.toFixed(1)} bps`
  );
}

function getDotColor(bps: number): string {
  if (bps > 0) return DANGER_COLOR;
  if (bps < 0) return SUCCESS_COLOR;
  return '#9ca3af';
}

function RangeBar({ row }: { row: GridEntry }) {
  const range = row.high - row.low;
  const pct = range > 0 ? ((row.close - row.low) / range) * 100 : 50;
  const bps = (row.close - row.prev) * 100;
  const dotColor = getDotColor(bps);
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        width: '130px',
      },
    },
    React.createElement(
      'span',
      { style: { fontSize: '11px', color: '#9ca3af', minWidth: '32px', textAlign: 'right' } },
      row.low.toFixed(2)
    ),
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          position: 'relative',
          height: '4px',
          background: '#e5e7eb',
          borderRadius: '2px',
        },
      },
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: `${Math.max(0, Math.min(92, pct))}%`,
          top: '-3px',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: dotColor,
          transform: 'translateX(-50%)',
        },
      })
    ),
    React.createElement(
      'span',
      { style: { fontSize: '11px', color: '#9ca3af', minWidth: '32px' } },
      row.high.toFixed(2)
    )
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
    width: '120px',
    right: true,
  },
  {
    name: 'Fecha/Hora',
    selector: (row: GridEntry) => row.operation_time,
    cell: (row: GridEntry) => formatDateTime(row.operation_time),
    sortable: true,
    width: '110px',
  },
  {
    name: 'Last',
    selector: (row: GridEntry) => row.close.toFixed(2),
    sortable: true,
    width: '70px',
    right: true,
  },
  {
    name: 'Prev',
    selector: (row: GridEntry) => row.prev.toFixed(2),
    sortable: true,
    width: '70px',
    right: true,
  },
  {
    name: 'Open',
    selector: (row: GridEntry) => row.open.toFixed(2),
    sortable: true,
    width: '70px',
    right: true,
  },
  {
    name: 'Rango L/H',
    selector: (row: GridEntry) => row.low,
    sortable: false,
    cell: (row: GridEntry) => React.createElement(RangeBar, { row }),
    width: '170px',
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
