/* eslint-disable no-underscore-dangle, no-nested-ternary, lines-around-directive, react/jsx-props-no-spreading, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/control-has-associated-label */
'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, CSSProperties } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type VisibilityState,
  type FilterFn,
  type Column,
  type Table,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PricedXccy, PricedNdf, PricedIbrSwap } from 'src/types/trading';
import type { BlotterPreferences } from 'src/models/user/blotter-preferences';
import type { NdfLiquidationRow } from 'src/models/trading';
import ColumnFilterDropdown from './ColumnFilterDropdown';
import LiquidationsTable from './LiquidationsTable';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PortfolioRow = {
  id: string;
  type: 'XCCY' | 'NDF' | 'IBR';
  label: string;
  counterparty: string;
  notional_usd: number;
  maturity_date: string;
  detail: string;
  npv_cop: number;
  npv_usd: number;
  pnl_cop: number;
  carry_cop: number;
  carry_label: string;
  dv01: number;
  dv01_label: string;
  dv01_2?: number;
  dv01_2_label?: string;
  fx_delta?: number;
  error?: string;
  id_operacion?: string;
  trade_date?: string;
  sociedad?: string;
  id_banco?: string;
  estado?: string;
  _xccy?: PricedXccy;
  _ndf?: PricedNdf;
  _ibr?: PricedIbrSwap;
  // P&L comparativo (null = marca no disponible / N/A)
  pnl_1d_cop?: number | null;
  pnl_mtd_cop?: number | null;
  pnl_ytd_cop?: number | null;
  pnl_1d_usd?: number | null;
  pnl_mtd_usd?: number | null;
  pnl_ytd_usd?: number | null;
};

export type BlotterTableProps = {
  rows: PortfolioRow[];
  onDelete: (id: string, type: string) => void;
  onLiquidate?: (row: PortfolioRow) => void;
  onSelectXccy: (r: PricedXccy) => void;
  onSelectNdf: (r: PricedNdf) => void;
  onSelectIbr: (r: PricedIbrSwap) => void;
  canEdit?: boolean;
  canLiquidate?: boolean;
  prefs: BlotterPreferences;
  onPrefsChange: (p: BlotterPreferences | ((prev: BlotterPreferences) => BlotterPreferences)) => void;
  // Solo se pasa para el blotter de NDF. Cuando estadoFilter === 'Liquidado'
  // y este prop esta definido, se renderiza la tabla de eventos de liquidacion
  // en vez del table normal.
  liquidations?: NdfLiquidationRow[];
};

// ─── Helpers de formato ─────────────────────────────────────────────────────

const fmt = (v: number, dec = 2) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return fmt(v, 2);
};

const npvColor = (v: number) => (v >= 0 ? '#28a745' : '#dc3545');

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  XCCY: { bg: '#cce5ff', fg: '#004085' },
  NDF:  { bg: '#d4edda', fg: '#155724' },
  IBR:  { bg: '#fff3cd', fg: '#856404' },
};

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  Activo:    { bg: '#d4edda', color: '#155724' },
  Vencido:   { bg: '#f8d7da', color: '#721c24' },
  Cancelado: { bg: '#e2e3e5', color: '#383d41' },
  Liquidado: { bg: '#e9d5ff', color: '#6b21a8' },
};

// ─── Filter / sort helpers ──────────────────────────────────────────────────

// FilterFn que aplica "value-in-array": el valor de la fila tiene que estar
// en el array filterValue. Si el array es vacio/undefined, no filtra.
// Se usa para el dropdown tipo Excel de las primeras 9 columnas.
const inSetFilter: FilterFn<PortfolioRow> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  const v = row.getValue(columnId);
  return filterValue.includes(String(v ?? ''));
};

// Helper que construye el header de una columna filtrable. Renderiza el
// titulo + el dropdown de filtros (ColumnFilterDropdown). El click en el
// titulo sigue disparando el toggle de sort (heredado del DraggableHeader);
// el dropdown usa stopPropagation para no interferir.
//
// Devuelve un objeto con `render` (la funcion que tanstack llama). Se evita
// definir un componente anonimo para no chocar con react/function-component-definition.
function makeFilterableHeader(
  title: string,
  rowAccessor: (r: PortfolioRow) => string | number | null | undefined,
) {
  // eslint-disable-next-line react/display-name
  return function FilterableHeader({ column, table }: {
    column: Column<PortfolioRow, unknown>;
    table: Table<PortfolioRow>;
  }) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {title}
        <ColumnFilterDropdown<PortfolioRow>
          column={column}
          rows={table.options.data}
          accessor={rowAccessor}
        />
      </span>
    );
  };
}

// ─── Column definitions ─────────────────────────────────────────────────────

const columnHelper = createColumnHelper<PortfolioRow>();

const buildColumns = (
  onSelect: (r: PortfolioRow) => void,
  onDelete: (id: string, type: string) => void,
  canEdit: boolean,
  onLiquidate?: (row: PortfolioRow) => void,
  canLiquidate?: boolean,
) => [
  columnHelper.accessor('type', {
    id: 'type',
    header: makeFilterableHeader('Tipo', (r) => r.type),
    filterFn: inSetFilter,
    size: 60,
    cell: (info) => {
      const tc = TYPE_COLORS[info.getValue()];
      return (
        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.fg }}>
          {info.getValue()}
        </span>
      );
    },
  }),
  columnHelper.accessor('id_operacion', {
    id: 'id_operacion',
    header: makeFilterableHeader('ID Op', (r) => r.id_operacion ?? r.label ?? ''),
    filterFn: inSetFilter,
    size: 110,
    cell: (info) => {
      const r = info.row.original;
      const label = info.getValue() || r.label || '—';
      return (
        <button type="button" onClick={() => onSelect(r)} style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 11 }}>
          {label}
        </button>
      );
    },
  }),
  columnHelper.accessor('counterparty', {
    id: 'counterparty',
    header: makeFilterableHeader('Contraparte', (r) => r.counterparty),
    filterFn: inSetFilter,
    size: 110,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  columnHelper.accessor('sociedad', {
    id: 'sociedad',
    header: makeFilterableHeader('Sociedad', (r) => r.sociedad ?? ''),
    filterFn: inSetFilter,
    size: 80,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  // Nocional: convertido de display a accessor para soportar sort y filtro.
  // El accessor retorna el numero (notional_usd o notional_cop segun tipo).
  columnHelper.accessor(
    (r) => (r.type === 'IBR' ? (r._ibr?.notional ?? 0) : r.notional_usd),
    {
      id: 'notional',
      header: makeFilterableHeader(
        'Nocional',
        (r) => fmtMM(r.type === 'IBR' ? (r._ibr?.notional ?? 0) : r.notional_usd),
      ),
      filterFn: (row, _columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        const r = row.original as PortfolioRow;
        const display = fmtMM(r.type === 'IBR' ? (r._ibr?.notional ?? 0) : r.notional_usd);
        return filterValue.includes(display);
      },
      size: 100,
      cell: (info) => {
        const r = info.row.original;
        const val = r.type === 'IBR' ? (r._ibr?.notional ?? 0) : r.notional_usd;
        const ccy = r.type === 'IBR' ? 'COP' : 'USD';
        return (
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {fmtMM(val)} <span style={{ fontSize: 9, color: '#6c757d' }}>{ccy}</span>
          </span>
        );
      },
    },
  ),
  // Tasa/Strike: igual que Nocional — accessor que retorna el label formateado.
  columnHelper.accessor(
    (r) => {
      if (r._ndf) return r._ndf.strike;
      if (r._xccy) return r._xccy.usd_spread_bps;
      if (r._ibr) return r._ibr.fixed_rate;
      return 0;
    },
    {
      id: 'tasa_strike',
      header: makeFilterableHeader(
        'Tasa/Strike',
        (r) => {
          if (r._ndf) return fmt(r._ndf.strike, 2);
          if (r._xccy) return `${fmt(r._xccy.usd_spread_bps, 0)}bps`;
          if (r._ibr) return `${fmt(r._ibr.fixed_rate * 100, 2)}%`;
          return '—';
        },
      ),
      filterFn: (row, _columnId, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
        const r = row.original as PortfolioRow;
        let label = '—';
        if (r._ndf) label = fmt(r._ndf.strike, 2);
        else if (r._xccy) label = `${fmt(r._xccy.usd_spread_bps, 0)}bps`;
        else if (r._ibr) label = `${fmt(r._ibr.fixed_rate * 100, 2)}%`;
        return filterValue.includes(label);
      },
      size: 100,
      cell: (info) => {
        const r = info.row.original;
        let label = '—';
        if (r._ndf) label = fmt(r._ndf.strike, 2);
        else if (r._xccy) label = `${fmt(r._xccy.usd_spread_bps, 0)}bps`;
        else if (r._ibr) label = `${fmt(r._ibr.fixed_rate * 100, 2)}%`;
        return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{label}</span>;
      },
    },
  ),
  columnHelper.accessor('trade_date', {
    id: 'trade_date',
    header: makeFilterableHeader('F. Celebr.', (r) => r.trade_date ?? ''),
    filterFn: inSetFilter,
    size: 90,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  columnHelper.accessor('maturity_date', {
    id: 'maturity_date',
    header: makeFilterableHeader('Vencimiento', (r) => r.maturity_date),
    filterFn: inSetFilter,
    size: 95,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('estado', {
    id: 'estado',
    header: makeFilterableHeader('Estado', (r) => r.estado ?? ''),
    filterFn: inSetFilter,
    size: 85,
    cell: (info) => {
      const v = info.getValue();
      if (!v) return <span>—</span>;
      const s = ESTADO_STYLES[v] ?? { bg: '#e2e3e5', color: '#383d41' };
      return (
        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>
          {v}
        </span>
      );
    },
  }),
  columnHelper.accessor('npv_cop', {
    id: 'npv_cop',
    header: 'NPV COP',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      // #296: show em-dash with a tooltip instead of a fake "0" or a loud
      // red "Err" — keeps the table legible while making "sin precio"
      // visually distinct from "precio cero".
      return r.error
        ? <span title={r.error} style={{ color: '#adb5bd', fontSize: 11, fontFamily: 'monospace' }}>—</span>
        : <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(info.getValue()) }}>{fmtMM(info.getValue())}</span>;
    },
  }),
  columnHelper.accessor('npv_usd', {
    id: 'npv_usd',
    header: 'NPV USD',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      return r.error
        ? <span title={r.error} style={{ color: '#adb5bd', fontSize: 11, fontFamily: 'monospace' }}>—</span>
        : <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(info.getValue()) }}>{fmtMM(info.getValue())}</span>;
    },
  }),
  columnHelper.accessor('carry_cop', {
    id: 'carry_cop',
    header: 'Carry COP',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      return r.error ? <span>—</span> : (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(info.getValue()) }}>
          {fmtMM(info.getValue())} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.carry_label}</span>
        </span>
      );
    },
  }),
  columnHelper.accessor('dv01', {
    id: 'dv01',
    header: 'DV01',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      return r.error ? <span>—</span> : (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(info.getValue()) }}>
          {fmtMM(info.getValue())} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.dv01_label}</span>
        </span>
      );
    },
  }),
  columnHelper.accessor('dv01_2', {
    id: 'dv01_2',
    header: 'DV01 (2)',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)} <span style={{ fontSize: 9, color: '#6c757d' }}>{r.dv01_2_label}</span></span>
        : <span>—</span>;
    },
  }),
  columnHelper.accessor('fx_delta', {
    id: 'fx_delta',
    header: 'FX Delta',
    size: 90,
    cell: (info) => {
      const v = info.getValue();
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span>—</span>;
    },
  }),
  // ── Columnas ocultas por defecto ──
  columnHelper.display({
    id: 'direction',
    header: 'Dirección',
    size: 80,
    cell: (info) => {
      const r = info.row.original;
      if (r._ndf) return <span style={{ fontSize: 11 }}>{r._ndf.direction === 'buy' ? 'Compra' : 'Venta'}</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'strike',
    header: 'Strike',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      if (r._ndf) return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmt(r._ndf.strike, 2)}</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'forward',
    header: 'Forward',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      if (r._ndf && !r._ndf.error) return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmt(r._ndf.forward, 2)}</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'forward_points',
    header: 'Fwd Points',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      if (r._ndf && !r._ndf.error) return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmt(r._ndf.forward_points, 2)}</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'days_to_maturity',
    header: 'Días',
    size: 65,
    cell: (info) => {
      const r = info.row.original;
      if (r._ndf) return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r._ndf.days_to_maturity ?? '—'}</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'par_basis_bps',
    header: 'Par Basis',
    size: 85,
    cell: (info) => {
      const r = info.row.original;
      if (r._xccy && r._xccy.par_basis_bps != null) return <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(r._xccy.par_basis_bps) }}>{fmt(r._xccy.par_basis_bps, 1)}bps</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'fair_rate',
    header: 'Fair Rate',
    size: 85,
    cell: (info) => {
      const r = info.row.original;
      if (r._ibr && !r._ibr.error) return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{fmt(r._ibr.fair_rate * 100, 2)}%</span>;
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'pnl_rate_cop',
    header: 'P&L Tasas',
    size: 95,
    cell: (info) => {
      const r = info.row.original;
      if (r._xccy && !r._xccy.error) {
        const v = r._xccy.pnl_rate_cop ?? 0;
        return <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>;
      }
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'pnl_fx_cop',
    header: 'P&L FX',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      if (r._xccy && !r._xccy.error) {
        const v = r._xccy.pnl_fx_cop ?? 0;
        return <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>;
      }
      return <span>—</span>;
    },
  }),
  columnHelper.display({
    id: 'carry_daily_diff_bps',
    header: 'Carry Diff',
    size: 85,
    cell: (info) => {
      const r = info.row.original;
      if (r._ibr && !r._ibr.error) return <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(r._ibr.carry_daily_diff_bps) }}>{fmt(r._ibr.carry_daily_diff_bps, 1)}bps</span>;
      return <span>—</span>;
    },
  }),
  // ── Columnas P&L comparativo (ocultas por defecto) ──
  columnHelper.accessor('pnl_1d_cop', {
    id: 'pnl_1d_cop',
    header: 'P&L 1D COP',
    size: 95,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  columnHelper.accessor('pnl_mtd_cop', {
    id: 'pnl_mtd_cop',
    header: 'P&L MTD COP',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  columnHelper.accessor('pnl_ytd_cop', {
    id: 'pnl_ytd_cop',
    header: 'P&L YTD COP',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  columnHelper.accessor('pnl_1d_usd', {
    id: 'pnl_1d_usd',
    header: 'P&L 1D USD',
    size: 90,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  columnHelper.accessor('pnl_mtd_usd', {
    id: 'pnl_mtd_usd',
    header: 'P&L MTD USD',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  columnHelper.accessor('pnl_ytd_usd', {
    id: 'pnl_ytd_usd',
    header: 'P&L YTD USD',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      const v = info.getValue();
      if (r.error) return <span>—</span>;
      return v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: npvColor(v) }}>{fmtMM(v)}</span>
        : <span style={{ color: '#adb5bd', fontSize: 10 }}>N/A</span>;
    },
  }),
  // ── Columna de acciones ──
  // Liquidar (solo NDF Activo): congela el NPV actual como P&G realizado.
  // Eliminar: borra la fila para siempre.
  columnHelper.display({
    id: 'actions',
    header: '',
    size: 100,
    enableHiding: false,
    enableSorting: false,
    enableResizing: false,
    cell: (info) => {
      const r = info.row.original;
      if (!canEdit) return null;
      const showLiquidate = canLiquidate
        && r.type === 'NDF'
        && r.estado === 'Activo'
        && onLiquidate != null;
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
          {showLiquidate && (
            <button
              type="button"
              title="Liquidar — congela el NPV actual como P&G realizado"
              onClick={(e) => { e.stopPropagation(); onLiquidate!(r); }}
              style={{
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                color: '#155724',
                cursor: 'pointer',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 3,
                fontWeight: 600,
                letterSpacing: '0.02em',
                lineHeight: 1.4,
              }}
            >
              Liquidar
            </button>
          )}
          <button
            type="button"
            title="Eliminar"
            onClick={() => onDelete(r.id, r.type)}
            style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 12, padding: 2 }}
          >
            ✕
          </button>
        </div>
      );
    },
  }),
];

// ─── Sortable Header Cell ────────────────────────────────────────────────────

function DraggableHeader({
  header,
  children,
}: {
  header: { id: string; getSize: () => number; column: { getCanSort: () => boolean; getToggleSortingHandler: () => ((e: unknown) => void) | undefined; getIsSorted: () => false | 'asc' | 'desc'; getCanResize: () => boolean }; getResizeHandler: () => (e: React.MouseEvent | React.TouchEvent) => void };
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    width: header.getSize(),
    padding: '8px 6px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    background: isDragging ? '#e9ecef' : undefined,
    cursor: header.column.getCanSort() ? 'pointer' : 'default',
    zIndex: isDragging ? 10 : undefined,
  };

  const sorted = header.column.getIsSorted();

  return (
    <th ref={setNodeRef} style={style}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={header.column.getToggleSortingHandler()}
        {...attributes}
        {...listeners}
      >
        {children}
        {sorted === 'asc' && <span style={{ fontSize: 10, color: '#0d6efd' }}>▲</span>}
        {sorted === 'desc' && <span style={{ fontSize: 10, color: '#0d6efd' }}>▼</span>}
        {!sorted && header.column.getCanSort() && <span style={{ fontSize: 10, color: '#dee2e6' }}>⇅</span>}
      </div>
      {/* Resize handle */}
      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          style={{
            position: 'absolute', right: 0, top: 0, height: '100%',
            width: 5, cursor: 'col-resize', zIndex: 1,
            background: 'transparent',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </th>
  );
}

// ─── Column visibility dropdown ──────────────────────────────────────────────

const COLUMN_LABELS: Record<string, string> = {
  type: 'Tipo', id_operacion: 'ID Op', counterparty: 'Contraparte', sociedad: 'Sociedad',
  notional: 'Nocional', tasa_strike: 'Tasa/Strike', trade_date: 'F. Celebr.',
  maturity_date: 'Vencimiento', estado: 'Estado', npv_cop: 'NPV COP', npv_usd: 'NPV USD',
  carry_cop: 'Carry COP', dv01: 'DV01', dv01_2: 'DV01 (2)', fx_delta: 'FX Delta',
  direction: 'Dirección', strike: 'Strike', forward: 'Forward', forward_points: 'Fwd Points',
  days_to_maturity: 'Días Mat.', par_basis_bps: 'Par Basis', fair_rate: 'Fair Rate',
  pnl_rate_cop: 'P&L Tasas', pnl_fx_cop: 'P&L FX', carry_daily_diff_bps: 'Carry Diff',
  pnl_1d_cop: 'P&L 1D COP', pnl_mtd_cop: 'P&L MTD COP', pnl_ytd_cop: 'P&L YTD COP',
  pnl_1d_usd: 'P&L 1D USD', pnl_mtd_usd: 'P&L MTD USD', pnl_ytd_usd: 'P&L YTD USD',
};

function ColumnVisibilityDropdown({
  visibility,
  onToggle,
  onReset,
}: {
  visibility: VisibilityState;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const columns = Object.keys(COLUMN_LABELS).filter((id) => id !== 'actions');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
          border: '1px solid #dee2e6', background: open ? '#e9ecef' : '#fff',
          cursor: 'pointer', color: '#495057', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ⚙ Columnas
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 1000, background: '#fff',
          border: '1px solid #dee2e6', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          padding: 12, minWidth: 200, maxHeight: 360, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6c757d', marginBottom: 8, textTransform: 'uppercase' }}>Columnas visibles</div>
          {columns.map((colId) => (
            <label key={colId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '3px 0' }}>
              <input
                type="checkbox"
                checked={visibility[colId] !== false}
                onChange={() => onToggle(colId)}
              />
              {COLUMN_LABELS[colId] ?? colId}
            </label>
          ))}
          <div style={{ borderTop: '1px solid #dee2e6', marginTop: 10, paddingTop: 8 }}>
            <button
              type="button"
              onClick={onReset}
              style={{ fontSize: 11, color: '#dc3545', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ↺ Resetear columnas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BlotterTable ────────────────────────────────────────────────────────────

export default function BlotterTable({
  rows,
  onDelete,
  onLiquidate,
  onSelectXccy,
  onSelectNdf,
  onSelectIbr,
  canEdit = true,
  canLiquidate = false,
  prefs,
  onPrefsChange,
  liquidations,
}: BlotterTableProps) {
  // Derived state from prefs
  const {
    sorting,
    columnVisibility,
    columnSizing,
    columnOrder,
    estadoFilter,
    globalFilter,
  } = prefs;

  const handleSelect = useCallback((r: PortfolioRow) => {
    if (r._xccy) onSelectXccy(r._xccy);
    else if (r._ndf) onSelectNdf(r._ndf);
    else if (r._ibr) onSelectIbr(r._ibr);
  }, [onSelectXccy, onSelectNdf, onSelectIbr]);

  const columns = useMemo(
    () => buildColumns(handleSelect, onDelete, canEdit, onLiquidate, canLiquidate),
    [handleSelect, onDelete, canEdit, onLiquidate, canLiquidate],
  );

  // Filter rows by estado first
  const filteredByEstado = useMemo(
    () => estadoFilter === 'Todos' ? rows : rows.filter((r) => r.estado === estadoFilter),
    [rows, estadoFilter],
  );

  const counts = useMemo(() => {
    const c = { Activo: 0, Vencido: 0, Cancelado: 0, Liquidado: 0 };
    rows.forEach((r) => { if (r.estado && r.estado in c) c[r.estado as keyof typeof c] += 1; });
    return c;
  }, [rows]);

  const table = useReactTable({
    data: filteredByEstado,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnSizing,
      columnOrder,
      globalFilter,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onPrefsChange((p) => ({ ...p, sorting: next }));
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater;
      onPrefsChange((p) => ({ ...p, columnVisibility: next }));
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnSizing) : updater;
      onPrefsChange((p) => ({ ...p, columnSizing: next }));
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnOrder) : updater;
      onPrefsChange((p) => ({ ...p, columnOrder: next }));
    },
    onGlobalFilterChange: (value) => {
      onPrefsChange((p) => ({ ...p, globalFilter: value as string }));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });

  // DnD sensors. activationConstraint exige mover el mouse 5px antes de
  // iniciar el drag — asi un click corto sobre el ▾ del filtro (o sobre
  // el header para hacer sort) NO se interpreta como inicio de drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(active.id as string);
    const newIndex = columnOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
    onPrefsChange((p) => ({ ...p, columnOrder: newOrder }));
  }, [columnOrder, onPrefsChange]);

  // Totals footer (solo filas sin error)
  const totals = useMemo(() => {
    const valid = filteredByEstado.filter((r) => !r.error);
    return {
      npv_cop: valid.reduce((s, r) => s + r.npv_cop, 0),
      npv_usd: valid.reduce((s, r) => s + r.npv_usd, 0),
      carry_cop: valid.reduce((s, r) => s + r.carry_cop, 0),
      dv01: valid.reduce((s, r) => s + r.dv01, 0),
      dv01_2: valid.reduce((s, r) => s + (r.dv01_2 ?? 0), 0),
      fx_delta: valid.reduce((s, r) => s + (r.fx_delta ?? 0), 0),
      pnl_1d_cop: valid.reduce((s, r) => s + (r.pnl_1d_cop ?? 0), 0),
      pnl_mtd_cop: valid.reduce((s, r) => s + (r.pnl_mtd_cop ?? 0), 0),
      pnl_ytd_cop: valid.reduce((s, r) => s + (r.pnl_ytd_cop ?? 0), 0),
      pnl_1d_usd: valid.reduce((s, r) => s + (r.pnl_1d_usd ?? 0), 0),
      pnl_mtd_usd: valid.reduce((s, r) => s + (r.pnl_mtd_usd ?? 0), 0),
      pnl_ytd_usd: valid.reduce((s, r) => s + (r.pnl_ytd_usd ?? 0), 0),
      count: valid.length,
    };
  }, [filteredByEstado]);

  // Cuando se está en Liquidado y hay liquidaciones, NO bloquear con empty
  // state aunque no haya rows: el LiquidationsTable maneja su propio vacio.
  const showLiquidationsView = estadoFilter === 'Liquidado' && liquidations !== undefined;

  if (rows.length === 0 && !showLiquidationsView) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6c757d', border: '2px dashed #dee2e6', borderRadius: 8 }}>
        No hay posiciones. Agrega una desde el botón o desde los pricers individuales.
      </div>
    );
  }

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => c.id);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Filtro Estado */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>Estado:</span>
          {(['Todos', 'Activo', 'Vencido', 'Cancelado', 'Liquidado'] as const).map((opt) => {
            const count = opt === 'Todos' ? rows.length : counts[opt];
            const active = estadoFilter === opt;
            const s = opt !== 'Todos' ? ESTADO_STYLES[opt] : null;
            return (
              <button
                type="button"
                key={opt}
                onClick={() => onPrefsChange((p) => ({ ...p, estadoFilter: opt }))}
                style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: active ? '2px solid #495057' : '1px solid #dee2e6',
                  background: active && s ? s.bg : active ? '#495057' : '#f8f9fa',
                  color: active && s ? s.color : active ? '#fff' : '#6c757d',
                }}
              >
                {opt} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Buscador global */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar…"
            value={globalFilter}
            onChange={(e) => onPrefsChange((p) => ({ ...p, globalFilter: e.target.value }))}
            style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid #ced4da',
              width: 160, outline: 'none',
            }}
          />
          {/* Column visibility */}
          <ColumnVisibilityDropdown
            visibility={columnVisibility}
            onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
            onReset={() => {
              import('src/models/user/blotter-preferences').then(({ DEFAULT_BLOTTER_PREFERENCES }) => {
                onPrefsChange((p) => ({
                  ...p,
                  columnVisibility: DEFAULT_BLOTTER_PREFERENCES.columnVisibility,
                  columnOrder: DEFAULT_BLOTTER_PREFERENCES.columnOrder,
                  columnSizing: {},
                }));
              });
            }}
          />
        </div>
      </div>

      {/* Table — switch a vista de eventos cuando estadoFilter='Liquidado' y se pasaron liquidations */}
      {showLiquidationsView ? (
        <LiquidationsTable liquidations={liquidations!} />
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader key={header.id} header={header}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </DraggableHeader>
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: '6px', overflow: 'hidden', textOverflow: 'ellipsis', width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #343a40', background: '#f1f3f5' }}>
                {visibleColumnIds.map((colId, idx) => {
                  const tStyle: CSSProperties = { padding: '8px 6px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700 };
                  if (idx === 0) {
                    // Solo en la primera columna visible ponemos el texto de totales
                    return (
                      <td key={colId} style={tStyle}>
                        TOTAL ({totals.count})
                      </td>
                    );
                  }
                  if (colId === 'npv_cop') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.npv_cop) }}>{fmtMM(totals.npv_cop)}</td>;
                  if (colId === 'npv_usd') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.npv_usd) }}>{fmtMM(totals.npv_usd)}</td>;
                  if (colId === 'carry_cop') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.carry_cop) }}>{fmtMM(totals.carry_cop)}</td>;
                  if (colId === 'dv01') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.dv01) }}>{fmtMM(totals.dv01)}</td>;
                  if (colId === 'dv01_2') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.dv01_2) }}>{fmtMM(totals.dv01_2)}</td>;
                  if (colId === 'fx_delta') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.fx_delta) }}>{fmtMM(totals.fx_delta)}</td>;
                  if (colId === 'pnl_1d_cop') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_1d_cop) }}>{fmtMM(totals.pnl_1d_cop)}</td>;
                  if (colId === 'pnl_mtd_cop') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_mtd_cop) }}>{fmtMM(totals.pnl_mtd_cop)}</td>;
                  if (colId === 'pnl_ytd_cop') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_ytd_cop) }}>{fmtMM(totals.pnl_ytd_cop)}</td>;
                  if (colId === 'pnl_1d_usd') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_1d_usd) }}>{fmtMM(totals.pnl_1d_usd)}</td>;
                  if (colId === 'pnl_mtd_usd') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_mtd_usd) }}>{fmtMM(totals.pnl_mtd_usd)}</td>;
                  if (colId === 'pnl_ytd_usd') return <td key={colId} style={{ ...tStyle, color: npvColor(totals.pnl_ytd_usd) }}>{fmtMM(totals.pnl_ytd_usd)}</td>;
                  return <td key={colId} />;
                })}
              </tr>
            </tfoot>
          </table>
        </DndContext>
      </div>
      )}
    </div>
  );
}
