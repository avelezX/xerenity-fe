/* eslint-disable no-nested-ternary, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/control-has-associated-label */
'use client';

import React, { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table';
import type { Loan } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LoansBlotterProps = {
  loans: Loan[];
  typeFilter: string;
  globalFilter: string;
  onGlobalFilterChange: (v: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDelete: (loan: Loan) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  ibr:  { bg: '#fff3cd', fg: '#856404' },
  uvr:  { bg: '#e8d5f5', fg: '#6f42c1' },
  fija: { bg: '#cce5ff', fg: '#004085' },
};

const TYPE_LABELS: Record<string, string> = {
  ibr: 'IBR',
  uvr: 'UVR',
  fija: 'Tasa Fija',
};

const DAYS_COUNT_LABELS: Record<string, string> = {
  por_dias_360: '30/360',
  por_dias_365: 'Act/365',
  por_periodo: 'Por Periodo',
};

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// ─── Column definitions ─────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Loan>();

const COLUMN_LABELS: Record<string, string> = {
  select: '',
  bank: 'Banco',
  loan_identifier: 'Identificador',
  type: 'Tipo',
  original_balance: 'Monto',
  interest_rate: 'Tasa Nominal',
  spread: 'Spread',
  periodicity: 'Periodicidad',
  number_of_payments: 'Periodos',
  start_date: 'F. Inicio',
  days_count: 'Conteo Días',
  grace: 'Gracia',
  min_period_rate: 'Tasa Mín.',
  actions: 'Acciones',
};

const DEFAULT_VISIBILITY: VisibilityState = {
  select: true,
  bank: true,
  loan_identifier: true,
  type: true,
  original_balance: true,
  interest_rate: true,
  spread: true,
  periodicity: true,
  number_of_payments: true,
  start_date: true,
  days_count: false,
  grace: false,
  min_period_rate: false,
  actions: true,
};

const buildColumns = (
  onDelete: (loan: Loan) => void,
  selectedIds: Set<string>,
  onToggleSelect: (id: string) => void,
  onToggleSelectAll: () => void,
  allSelected: boolean,
) => [
  columnHelper.display({
    id: 'select',
    size: 36,
    enableHiding: false,
    enableSorting: false,
    enableResizing: false,
    header: () => (
      <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
    ),
    cell: (info) => (
      <input
        type="checkbox"
        checked={selectedIds.has(info.row.original.id)}
        onChange={() => onToggleSelect(info.row.original.id)}
      />
    ),
  }),
  columnHelper.accessor('bank', {
    id: 'bank',
    header: 'Banco',
    size: 120,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  columnHelper.accessor('loan_identifier', {
    id: 'loan_identifier',
    header: 'Identificador',
    size: 120,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  columnHelper.accessor('type', {
    id: 'type',
    header: 'Tipo',
    size: 80,
    cell: (info) => {
      const v = info.getValue();
      const tc = TYPE_COLORS[v] ?? { bg: '#e2e3e5', fg: '#383d41' };
      return (
        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.fg }}>
          {TYPE_LABELS[v] ?? v}
        </span>
      );
    },
  }),
  columnHelper.accessor('original_balance', {
    id: 'original_balance',
    header: 'Monto',
    size: 120,
    cell: (info) => (
      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
        {currencyFormat(info.getValue(), 0)}
      </span>
    ),
  }),
  columnHelper.accessor('interest_rate', {
    id: 'interest_rate',
    header: 'Tasa Nominal',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      const label = r.type === 'fija'
        ? `${info.getValue()}%`
        : `${TYPE_LABELS[r.type] ?? r.type}`;
      return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{label}</span>;
    },
  }),
  columnHelper.display({
    id: 'spread',
    header: 'Spread',
    size: 80,
    cell: (info) => {
      const r = info.row.original;
      const label = r.type === 'fija' ? '—' : `${r.interest_rate}%`;
      return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{label}</span>;
    },
  }),
  columnHelper.accessor('periodicity', {
    id: 'periodicity',
    header: 'Periodicidad',
    size: 100,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  columnHelper.accessor('number_of_payments', {
    id: 'number_of_payments',
    header: 'Periodos',
    size: 70,
    cell: (info) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('start_date', {
    id: 'start_date',
    header: 'F. Inicio',
    size: 100,
    cell: (info) => <span style={{ fontSize: 11 }}>{info.getValue() || '—'}</span>,
  }),
  // ── Hidden by default ──
  columnHelper.accessor('days_count', {
    id: 'days_count',
    header: 'Conteo Días',
    size: 90,
    cell: (info) => <span style={{ fontSize: 11 }}>{DAYS_COUNT_LABELS[info.getValue()] ?? info.getValue()}</span>,
  }),
  columnHelper.display({
    id: 'grace',
    header: 'Gracia',
    size: 100,
    cell: (info) => {
      const r = info.row.original;
      if (!r.grace_type || !r.grace_period) return <span>—</span>;
      return <span style={{ fontSize: 11 }}>{r.grace_type} ({r.grace_period})</span>;
    },
  }),
  columnHelper.accessor('min_period_rate', {
    id: 'min_period_rate',
    header: 'Tasa Mín.',
    size: 80,
    cell: (info) => {
      const v = info.getValue();
      return v ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}%</span> : <span>—</span>;
    },
  }),
  // ── Actions ──
  columnHelper.display({
    id: 'actions',
    header: '',
    size: 40,
    enableHiding: false,
    enableSorting: false,
    enableResizing: false,
    cell: (info) => (
      <button
        type="button"
        title="Eliminar"
        onClick={() => onDelete(info.row.original)}
        style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: 12, padding: 2 }}
      >
        ✕
      </button>
    ),
  }),
];

// ─── Sortable Header ────────────────────────────────────────────────────────

function SortableHeader({
  header,
  children,
}: {
  header: {
    id: string;
    getSize: () => number;
    column: {
      getCanSort: () => boolean;
      getToggleSortingHandler: () => ((e: unknown) => void) | undefined;
      getIsSorted: () => false | 'asc' | 'desc';
      getCanResize: () => boolean;
    };
    getResizeHandler: () => (e: React.MouseEvent | React.TouchEvent) => void;
  };
  children: React.ReactNode;
}) {
  const sorted = header.column.getIsSorted();

  const style: CSSProperties = {
    width: header.getSize(),
    padding: '8px 6px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: header.column.getCanSort() ? 'pointer' : 'default',
    position: 'relative',
  };

  return (
    <th style={style}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={header.column.getToggleSortingHandler()}
      >
        {children}
        {sorted === 'asc' && <span style={{ fontSize: 10, color: '#0d6efd' }}>▲</span>}
        {sorted === 'desc' && <span style={{ fontSize: 10, color: '#0d6efd' }}>▼</span>}
        {!sorted && header.column.getCanSort() && <span style={{ fontSize: 10, color: '#dee2e6' }}>⇅</span>}
      </div>
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

// ─── Column Visibility Dropdown ─────────────────────────────────────────────

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

  const toggleableColumns = Object.keys(COLUMN_LABELS).filter((id) => id !== 'actions' && id !== 'select');

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
          {toggleableColumns.map((colId) => (
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

// ─── LoansBlotterTable ──────────────────────────────────────────────────────

export default function LoansBlotterTable({
  loans,
  typeFilter,
  globalFilter,
  onGlobalFilterChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: LoansBlotterProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // Filter by type
  const filteredByType = useMemo(
    () => typeFilter === 'Todos' ? loans : loans.filter((l) => l.type === typeFilter),
    [loans, typeFilter],
  );

  const allSelected = filteredByType.length > 0 && filteredByType.every((l) => selectedIds.has(l.id));

  const columns = useMemo(
    () => buildColumns(onDelete, selectedIds, onToggleSelect, onToggleSelectAll, allSelected),
    [onDelete, selectedIds, onToggleSelect, onToggleSelectAll, allSelected],
  );

  const table = useReactTable({
    data: filteredByType,
    columns,
    state: { sorting, columnVisibility, columnSizing, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });

  // Totals
  const totals = useMemo(() => {
    const total = filteredByType.reduce((acc, l) => acc + l.original_balance, 0);
    const ibrLoans = filteredByType.filter((l) => l.type === 'ibr');
    const uvrLoans = filteredByType.filter((l) => l.type === 'uvr');
    const fijaLoans = filteredByType.filter((l) => l.type === 'fija');
    return {
      count: filteredByType.length,
      total_balance: total,
      ibr_count: ibrLoans.length,
      uvr_count: uvrLoans.length,
      fija_count: fijaLoans.length,
    };
  }, [filteredByType]);

  if (loans.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6c757d', border: '2px dashed #dee2e6', borderRadius: 8 }}>
        No hay créditos. Agrega uno desde el botón &quot;Nuevo Crédito&quot;.
      </div>
    );
  }

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => c.id);

  return (
    <div>
      {/* Toolbar: search + column visibility */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
        <input
          type="text"
          placeholder="Buscar…"
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid #ced4da',
            width: 160, outline: 'none',
          }}
        />
        <ColumnVisibilityDropdown
          visibility={columnVisibility}
          onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
          onReset={() => setColumnVisibility(DEFAULT_VISIBILITY)}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                {headerGroup.headers.map((header) => (
                  <SortableHeader key={header.id} header={header}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </SortableHeader>
                ))}
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
                  return (
                    <td key={colId} style={tStyle}>
                      TOTAL ({totals.count})
                    </td>
                  );
                }
                if (colId === 'original_balance') {
                  return (
                    <td key={colId} style={tStyle}>
                      {fmtMM(totals.total_balance)}
                    </td>
                  );
                }
                if (colId === 'type') {
                  return (
                    <td key={colId} style={{ ...tStyle, fontSize: 10 }}>
                      {totals.ibr_count > 0 && <span style={{ color: '#856404' }}>IBR:{totals.ibr_count} </span>}
                      {totals.uvr_count > 0 && <span style={{ color: '#6f42c1' }}>UVR:{totals.uvr_count} </span>}
                      {totals.fija_count > 0 && <span style={{ color: '#004085' }}>Fija:{totals.fija_count}</span>}
                    </td>
                  );
                }
                return <td key={colId} />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
