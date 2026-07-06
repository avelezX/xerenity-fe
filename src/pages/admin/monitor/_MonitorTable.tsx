'use client';

/* eslint-disable react/no-unstable-nested-components */
// TanStack columnDef requires inline cell-renderer functions; the columns
// array is stable via useMemo so reconciliation isn't thrashing.

// Power-table for /admin/monitor — operational health focus.
//   - sort / global search / group-by (none | kind | source)
//   - filters: source, kind
//   - quick toggles (only critical / only failing-or-stale)
//   - columns emphasise run health + data freshness; catalog metadata
//     (categories/country/review) lives in the per-collector Catálogo tab.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { Badge, Form } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faCircleMinus,
  faClock,
  faArrowUpRightFromSquare,
  faSort,
  faSortUp,
  faSortDown,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  CollectorOverviewEnriched,
  CollectorFreshness,
  CollectorKind,
  WriteMode,
  RunStatus,
} from 'src/types/monitor';

// ─────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────

const TableWrap = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow-x: auto;
  overflow-y: visible;

  table { width: 100%; margin: 0; border-collapse: collapse; }
  thead th {
    background: #302b63;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
    cursor: default;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  thead th.sortable { cursor: pointer; }
  thead th.sortable:hover { background: #3d3680; }
  tbody td {
    font-size: 13px;
    padding: 9px 12px;
    border-bottom: 1px solid #f1f1f4;
    vertical-align: middle;
    white-space: nowrap;
  }
  tbody tr:hover:not(.group-header) { background: rgba(48, 43, 99, 0.04); }
  tbody tr.group-header {
    background: #fafaff;
    cursor: pointer;
    user-select: none;
  }
  tbody tr.group-header td {
    font-weight: 700;
    color: #302b63;
    border-bottom: 2px solid #d8d8e6;
    padding: 8px 12px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: 11px;
  }
  tbody tr.group-header:hover td { background: #f0f0fa; }

  a { color: #302b63; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
`;

const Toolbar = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 0;
  }

  input[type='text'] { font-size: 13px; min-width: 220px; }
  select { font-size: 12px; min-width: 140px; }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #444;
    cursor: pointer;
    user-select: none;
    padding: 4px 8px;
    background: #f3f3f7;
    border-radius: 4px;
    &:hover { background: #e9e9f0; }
    input { margin: 0; }
  }
`;

const TableChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  max-width: 280px;
  font-family: monospace;
  font-size: 11px;
  code {
    background: #f3f3f7;
    padding: 1px 4px;
    border-radius: 3px;
    margin: 0 2px 2px 0;
    white-space: nowrap;
  }
`;

const StatusDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  vertical-align: middle;
`;

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const RUN_STATUS_CFG: Record<RunStatus, { bg: string; icon: typeof faCircleCheck }> = {
  success: { bg: '#28a745', icon: faCircleCheck },
  running: { bg: '#5bc0de', icon: faClock },
  failed: { bg: '#dc3545', icon: faCircleXmark },
  timeout: { bg: '#6c757d', icon: faCircleExclamation },
};

const KIND_CFG: Record<CollectorKind, { bg: string; label: string; title: string }> = {
  scheduled: { bg: '#4F46E5', label: 'scheduled', title: 'Corre en cron y se monitorea completo.' },
  backfill:  { bg: '#94a3b8', label: 'backfill',  title: 'Rellena huecos manualmente. No se monitorea.' },
  manual:    { bg: '#b0b0b0', label: 'manual',    title: 'Se corre a mano / deprecado. No se monitorea.' },
};

export type GroupByKey = 'none' | 'kind' | 'source';

const GROUP_BY_OPTIONS: { key: GroupByKey; label: string; columnId?: string }[] = [
  { key: 'kind', label: 'Por tipo (kind)', columnId: 'kind' },
  { key: 'none', label: 'Sin agrupar' },
  { key: 'source', label: 'Por fuente', columnId: 'source' },
];

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const statusColor = (row: CollectorOverviewEnriched): string => {
  if (row.has_critical_alert) return '#dc3545';
  if (row.has_warning_alert) return '#f0ad4e';
  if (!row.last_run) return '#b0b0b0';
  if (row.last_run.status === 'success') return '#28a745';
  if (row.last_run.status === 'running') return '#5bc0de';
  return '#dc3545';
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours}h`;
  const days = Math.round(hours / 24);
  return `hace ${days}d`;
};

const formatDuration = (s: number | null): string => {
  if (s == null) return '—';
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${m}m ${r}s`;
};

// rows_inserted is a net delta — 0 is expected (and NOT alarming) for
// recompute/upsert/delete_insert collectors.
const formatRows = (rows: number | null | undefined, writeMode: WriteMode) => {
  if (rows === null || rows === undefined) {
    return <span style={{ color: '#bbb' }} title="No capturado">—</span>;
  }
  if (rows === 0) {
    if (writeMode !== 'insert') {
      return (
        <span style={{ color: '#aaa' }} title={`0 filas esperado (${writeMode})`}>
          0 <span style={{ fontSize: 10 }}>(esperado)</span>
        </span>
      );
    }
    return (
      <span style={{ color: '#b8860b', fontWeight: 600 }} title="0 filas insertadas">0</span>
    );
  }
  return rows.toLocaleString();
};

const shortDate = (iso: string | null): string => {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
};

const FreshnessCell: React.FC<{ f: CollectorFreshness | null }> = ({ f }) => {
  if (!f || !f.oldest_max_date) {
    return <span style={{ color: '#bbb' }}>—</span>;
  }
  const tablesTitle = f.tables
    .map((t) => `${t.table}: ${shortDate(t.max_date) || 'sin datos'}${t.is_stale ? ' ⚠' : ''}`)
    .join('\n');
  return (
    <span title={tablesTitle} style={{ color: f.any_stale ? '#dc3545' : '#444' }}>
      {shortDate(f.oldest_max_date)}{' '}
      <span style={{ fontSize: 11, color: f.any_stale ? '#dc3545' : '#999' }}>
        ({formatRelative(f.oldest_max_date)})
      </span>
    </span>
  );
};

const sortIcon = (sorted: false | 'asc' | 'desc') => {
  if (sorted === 'asc') return faSortUp;
  if (sorted === 'desc') return faSortDown;
  return faSort;
};

const arrayIncludesAny = <T,>(rowVal: T[], filterVal: string[]): boolean => {
  if (!Array.isArray(filterVal) || filterVal.length === 0) return true;
  return rowVal.some((v) => filterVal.includes(String(v)));
};

// ─────────────────────────────────────────────────────────────────
// MultiSelect — button-driven checkbox dropdown for toolbar filters.
// ─────────────────────────────────────────────────────────────────

const MultiSelectWrap = styled.div`
  position: relative;
  display: inline-block;

  .summary {
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 3px 8px;
    background: #fff;
    font-size: 12px;
    cursor: pointer;
    min-width: 120px;
    text-align: left;
    color: #333;
    &:hover { border-color: #302b63; }
    &.active { border-color: #302b63; box-shadow: 0 0 0 2px rgba(48, 43, 99, 0.15); }
  }
  .panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: #fff;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 6px;
    min-width: 180px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    &:hover { background: #f3f3f7; }
    input { margin: 0; }
  }
  .clear {
    font-size: 11px;
    color: #888;
    padding: 4px 6px;
    cursor: pointer;
    border-top: 1px solid #eee;
    margin-top: 4px;
    text-align: center;
    &:hover { color: #302b63; }
  }
`;

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

const buildMultiSelectSummary = (value: string[]): string => {
  if (value.length === 0) return 'Todos';
  if (value.length <= 2) return value.join(', ');
  return `${value.length} seleccionados`;
};

const MultiSelect: React.FC<MultiSelectProps> = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const summary = buildMultiSelectSummary(value);

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <MultiSelectWrap>
      <button
        type="button"
        className={`summary ${value.length > 0 ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        {summary} <Icon icon={faChevronDown} style={{ fontSize: 9, marginLeft: 6 }} />
      </button>
      {open && (
        <div className="panel" onMouseLeave={() => setOpen(false)}>
          {options.length === 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: 6 }}>Sin opciones</div>
          )}
          {options.map((opt) => (
            <label key={opt} className="opt">
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
          {value.length > 0 && (
            <button
              type="button"
              className="clear"
              onClick={() => { onChange([]); setOpen(false); }}
              style={{ background: 'none', border: 'none', width: '100%' }}
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </MultiSelectWrap>
  );
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export interface MonitorTableProps {
  rows: CollectorOverviewEnriched[];
}

const MonitorTable: React.FC<MonitorTableProps> = ({ rows = [] }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyFailing, setOnlyFailing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByKey>('kind');

  const optionSets = useMemo(() => {
    const sources = new Set<string>();
    rows.forEach((r) => { if (r.source?.name) sources.add(r.source.name); });
    return { sources: Array.from(sources).sort() };
  }, [rows]);

  const visibleRows = useMemo(() => rows.filter((r) => {
    if (onlyCritical && !r.has_critical_alert) return false;
    if (onlyFailing) {
      const failing = r.last_run?.status === 'failed' || r.last_run?.status === 'timeout';
      const stale = r.has_warning_alert || r.has_critical_alert;
      if (!failing && !stale) return false;
    }
    return true;
  }), [rows, onlyCritical, onlyFailing]);

  const columns = useMemo<ColumnDef<CollectorOverviewEnriched>[]>(
    () => [
      {
        id: 'status',
        header: '',
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) => <StatusDot $color={statusColor(row.original)} />,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Collector',
        cell: ({ row }) => (
          <Link href={`/admin/monitor/${encodeURIComponent(row.original.name)}`}>
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'kind',
        accessorKey: 'kind',
        header: 'Tipo',
        filterFn: (r, _id, value) => arrayIncludesAny([r.original.kind], value as string[]),
        cell: ({ row }) => {
          const cfg = KIND_CFG[row.original.kind];
          return (
            <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              <Badge style={{ background: cfg.bg, fontWeight: 500 }} title={cfg.title}>
                {cfg.label}
              </Badge>
              {row.original.write_mode !== 'insert' && (
                <span style={{ fontSize: 10, color: '#999' }}>{row.original.write_mode}</span>
              )}
            </span>
          );
        },
      },
      {
        id: 'source',
        accessorFn: (r) => r.source?.name ?? '(sin fuente)',
        header: 'Fuente',
        filterFn: (row, _id, value) =>
          arrayIncludesAny([row.original.source?.name].filter(Boolean) as string[], value as string[]),
        cell: ({ row }) =>
          row.original.source ? (
            <span
              title={row.original.source.label}
              style={{
                display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#222',
                background: '#f3f3f7', border: '1px solid #d8d8e6', padding: '2px 8px',
                borderRadius: 4, whiteSpace: 'nowrap',
              }}
            >
              {row.original.source.name}
            </span>
          ) : (
            <span style={{ color: '#bbb', fontStyle: 'italic' }}>(sin fuente)</span>
          ),
      },
      {
        id: 'tables',
        accessorFn: (r) => r.target_tables.join(','),
        header: 'Tablas destino',
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) =>
          row.original.target_tables.length > 0 ? (
            <TableChips>
              {row.original.target_tables.map((t) => (<code key={t}>{t}</code>))}
            </TableChips>
          ) : (
            <span style={{ color: '#bbb' }}>—</span>
          ),
      },
      {
        id: 'cron',
        accessorFn: (r) => r.schedule_cron ?? '',
        header: 'Cron',
        enableGrouping: false,
        cell: ({ row }) =>
          row.original.schedule_cron ? (
            <code
              style={{
                fontFamily: 'monospace', fontSize: 11, background: '#f3f3f7',
                padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap', color: '#444',
              }}
              title="Click el collector para ver la traducción legible"
            >
              {row.original.schedule_cron}
            </code>
          ) : (
            <span style={{ color: '#bbb' }}>—</span>
          ),
      },
      {
        id: 'lastRun',
        accessorFn: (r) => r.last_run?.started_at ?? '',
        header: 'Último run',
        sortingFn: (a, b) => {
          const av = a.original.last_run?.started_at ?? '';
          const bv = b.original.last_run?.started_at ?? '';
          return av.localeCompare(bv);
        },
        cell: ({ row }) => {
          const lr = row.original.last_run;
          if (!lr) {
            return (
              <span style={{ color: '#999' }}>
                <Icon icon={faCircleMinus} style={{ marginRight: 4 }} /> nunca
              </span>
            );
          }
          const cfg = RUN_STATUS_CFG[lr.status];
          return (
            <span>
              <Badge style={{ background: cfg.bg, fontWeight: 500 }}>
                <Icon icon={cfg.icon} style={{ marginRight: 4 }} /> {lr.status}
              </Badge>
              <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                {formatRelative(lr.started_at)}
              </span>
            </span>
          );
        },
      },
      {
        id: 'freshness',
        accessorFn: (r) => r.freshness?.oldest_max_date ?? '',
        header: 'Frescura dato',
        enableGrouping: false,
        sortingFn: (a, b) => {
          const av = a.original.freshness?.oldest_max_date ?? '';
          const bv = b.original.freshness?.oldest_max_date ?? '';
          return av.localeCompare(bv);
        },
        cell: ({ row }) => <FreshnessCell f={row.original.freshness} />,
      },
      {
        id: 'duration',
        accessorFn: (r) => r.last_run?.duration_s ?? -1,
        header: 'Duración',
        enableGrouping: false,
        cell: ({ row }) => formatDuration(row.original.last_run?.duration_s ?? null),
      },
      {
        id: 'rows',
        accessorFn: (r) => r.last_run?.rows_inserted ?? -1,
        header: 'Filas',
        enableGrouping: false,
        cell: ({ row }) => formatRows(row.original.last_run?.rows_inserted, row.original.write_mode),
      },
      {
        id: 'alerts',
        accessorKey: 'open_alerts',
        header: 'Alertas',
        enableGrouping: false,
        cell: ({ getValue }) => {
          const v = Number(getValue());
          return v > 0 ? <Badge bg="danger">{v}</Badge> : <span style={{ color: '#ccc' }}>—</span>;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) =>
          row.original.last_run?.gh_run_url ? (
            <a href={row.original.last_run.gh_run_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              GH <Icon icon={faArrowUpRightFromSquare} />
            </a>
          ) : null,
      },
    ],
    [],
  );

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const out: ColumnFiltersState = [];
    if (sourceFilter.length > 0) out.push({ id: 'source', value: sourceFilter });
    if (kindFilter.length > 0) out.push({ id: 'kind', value: kindFilter });
    return out;
  }, [sourceFilter, kindFilter]);

  const grouping: GroupingState = useMemo(() => {
    const opt = GROUP_BY_OPTIONS.find((o) => o.key === groupBy);
    return opt?.columnId ? [opt.columnId] : [];
  }, [groupBy]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  React.useEffect(() => {
    if (grouping.length === 0) setExpanded({});
    else setExpanded(true);
  }, [grouping.length]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { globalFilter, columnFilters, grouping, sorting, expanded },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
    globalFilterFn: 'includesString',
  });

  const colCount = table.getAllLeafColumns().length;

  return (
    <>
      <Toolbar>
        <Form.Control
          type="text"
          placeholder="Buscar collector…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          size="sm"
        />

        <span className="inline">
          Fuente
          <MultiSelect options={optionSets.sources} value={sourceFilter} onChange={setSourceFilter} />
        </span>

        <span className="inline">
          Tipo
          <MultiSelect
            options={['scheduled', 'backfill', 'manual']}
            value={kindFilter}
            onChange={setKindFilter}
          />
        </span>

        <label className="inline">
          Agrupar
          <Form.Select
            size="sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
            style={{ minWidth: 150 }}
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Form.Select>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={onlyCritical} onChange={(e) => setOnlyCritical(e.target.checked)} />
          Solo críticos
        </label>

        <label className="toggle">
          <input type="checkbox" checked={onlyFailing} onChange={(e) => setOnlyFailing(e.target.checked)} />
          Solo failing/stale
        </label>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>
          {table.getRowModel().rows.filter((r) => !r.getIsGrouped()).length} de {visibleRows.length} collectors
        </span>
      </Toolbar>

      <TableWrap>
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={canSort ? 'sortable' : ''}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <Icon
                          icon={sortIcon(sorted)}
                          style={{ marginLeft: 6, opacity: sorted ? 1 : 0.4, fontSize: 10 }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const groupCol = row.getGroupingValue(grouping[0]);
                return (
                  <tr key={row.id} className="group-header" onClick={row.getToggleExpandedHandler()}>
                    <td colSpan={colCount}>
                      <Icon
                        icon={row.getIsExpanded() ? faChevronDown : faChevronRight}
                        style={{ marginRight: 8 }}
                      />
                      {String(groupCol ?? '—')}{' '}
                      <span style={{ color: '#999', fontWeight: 500, marginLeft: 8 }}>
                        ({row.subRows.length})
                      </span>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ textAlign: 'center', color: '#999', padding: 32, fontSize: 13 }}>
                  No hay collectors que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
};

export default MonitorTable;
