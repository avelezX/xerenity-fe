'use client';

/* eslint-disable react/no-unstable-nested-components */
// react/no-unstable-nested-components is disabled file-wide because
// TanStack Table's columnDef API requires inline cell-renderer functions
// (`cell: ({ row }) => …`) and the rule treats every arrow-returning-JSX
// as a fresh component. The columns array itself is stable via useMemo,
// so React reconciliation isn't actually thrashing.

// Power-table for /admin/monitor.
//
// Replaces the flat HTML table with a TanStack Table that supports:
//   - sort by any column
//   - per-column multi-select filters (source, severity, category, country)
//   - free-text global search
//   - quick toggles (only critical / only failing-or-stale)
//   - groupBy with collapsible Excel-pivot-style headers
//
// One-stop component to keep the page file focused on layout + alerts.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { Badge, Form, Button as BsButton } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faCircleMinus,
  faClock,
  faArrowUpRightFromSquare,
  faStar,
  faRobot,
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
  Severity,
  RunStatus,
} from 'src/types/monitor';
import ReviewBar from './_ReviewBar';

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

  input[type='text'] {
    font-size: 13px;
    min-width: 220px;
  }

  select {
    font-size: 12px;
    min-width: 140px;
  }

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

const Chip = styled.span<{ $color?: string }>`
  display: inline-block;
  font-size: 10px;
  background: ${(p) => p.$color ?? '#e9e9f0'};
  color: #444;
  padding: 1px 6px;
  border-radius: 3px;
  margin: 0 2px 2px 0;
  white-space: nowrap;
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

const SEV_COLORS: Record<Severity, string> = {
  critical: '#dc3545',
  warning: '#f0ad4e',
  info: '#5bc0de',
};

const RUN_STATUS_CFG: Record<RunStatus, { bg: string; icon: typeof faCircleCheck }> = {
  success: { bg: '#28a745', icon: faCircleCheck },
  running: { bg: '#5bc0de', icon: faClock },
  failed: { bg: '#dc3545', icon: faCircleXmark },
  timeout: { bg: '#6c757d', icon: faCircleExclamation },
};

export type GroupByKey =
  | 'none'
  | 'source'
  | 'severity'
  | 'category_first'
  | 'country_first'
  | 'review_worst';

const GROUP_BY_OPTIONS: { key: GroupByKey; label: string; columnId?: string }[] = [
  { key: 'none', label: 'Sin agrupar' },
  { key: 'source', label: 'Por fuente', columnId: 'source' },
  { key: 'severity', label: 'Por severity', columnId: 'severity' },
  { key: 'category_first', label: 'Por categoría', columnId: 'categoryFirst' },
  { key: 'country_first', label: 'Por país (datos)', columnId: 'countryFirst' },
  { key: 'review_worst', label: 'Por estado de revisión', columnId: 'reviewWorst' },
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

const formatRows = (rows: number | null | undefined) => {
  if (rows === null || rows === undefined) {
    return <span style={{ color: '#bbb' }} title="No capturado">—</span>;
  }
  if (rows === 0) {
    return (
      <span style={{ color: '#b8860b', fontWeight: 600 }} title="0 filas insertadas">
        0
      </span>
    );
  }
  return rows.toLocaleString();
};

// "Worst" review status seen across this collector's (collector, table)
// pairs. Used both as a sort key and as a groupBy bucket.
//
// Rationale for the order: deprecar > arreglar matter most operationally
// (something is actively broken or being killed); pendiente means "not
// reviewed yet", documentar/mantener mean we already looked and it's
// fine. Empty review distribution (total=0) sorts to "n/a" so freshly
// added collectors don't get bucketed as critical by accident.
const REVIEW_PRIORITY: Record<string, number> = {
  deprecar: 5,
  arreglar: 4,
  pendiente: 3,
  documentar: 2,
  mantener: 1,
  none: 0,
};
const worstReview = (row: CollectorOverviewEnriched): string => {
  const d = row.review_distribution;
  if (!d || d.total === 0) return 'n/a';
  const order: (keyof typeof REVIEW_PRIORITY)[] = ['deprecar', 'arreglar', 'pendiente', 'documentar', 'mantener'];
  // eslint-disable-next-line no-restricted-syntax
  for (const k of order) {
    if ((d as Record<string, number>)[k] > 0) return k;
  }
  return 'n/a';
};

// TanStack `getIsSorted` returns false | 'asc' | 'desc' — map that to
// the right Font Awesome icon. Extracted because the inline ternary
// triggers no-nested-ternary in the project's eslint config.
const sortIcon = (sorted: false | 'asc' | 'desc') => {
  if (sorted === 'asc') return faSortUp;
  if (sorted === 'desc') return faSortDown;
  return faSort;
};

// Multi-select filter helper — TanStack v8 default filter compares using
// `includesString`; for our chip-arrays we want OR semantics.
const arrayIncludesAny = <T,>(rowVal: T[], filterVal: string[]): boolean => {
  if (!Array.isArray(filterVal) || filterVal.length === 0) return true;
  return rowVal.some((v) => filterVal.includes(String(v)));
};

// ─────────────────────────────────────────────────────────────────
// MultiSelect — small button-driven dropdown for the toolbar filters.
// Native `<select multiple>` is awkward; this wraps a list of checkboxes
// behind a summary chip. Defined before MonitorTable so the reference
// inside the toolbar JSX doesn't trip @typescript-eslint/no-use-before-define.
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
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
              />
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
// Public types
// ─────────────────────────────────────────────────────────────────

export interface MonitorTableProps {
  rows: CollectorOverviewEnriched[];
  onDiagnose: (row: CollectorOverviewEnriched) => void;
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

// Default props guard the file against Next.js's pages-router static-
// optimisation pass, which tries to prerender every module under pages/
// (even underscore-prefixed components like this one) with no props.
// Without the defaults, `rows.forEach(...)` inside the option-sets useMemo
// blows up with a TypeError during `next build` and fails the deploy.
const MonitorTable: React.FC<MonitorTableProps> = ({
  rows = [],
  onDiagnose = () => {},
}) => {
  // ─── Toolbar state ────────────────────────────────────────────
  const [globalFilter, setGlobalFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyFailing, setOnlyFailing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByKey>('none');

  // ─── Distinct option sets — derived from rows ─────────────────
  const optionSets = useMemo(() => {
    const sources = new Set<string>();
    const categories = new Set<string>();
    const countries = new Set<string>();
    rows.forEach((r) => {
      if (r.source?.name) sources.add(r.source.name);
      r.categories.forEach((c) => categories.add(c));
      r.countries_data.forEach((c) => countries.add(c));
    });
    return {
      sources: Array.from(sources).sort(),
      categories: Array.from(categories).sort(),
      countries: Array.from(countries).sort(),
    };
  }, [rows]);

  // ─── Pre-filter applied before TanStack runs (toggles) ────────
  const visibleRows = useMemo(() => rows.filter((r) => {
    if (onlyCritical && !(r.has_critical_alert || r.is_critical_any)) return false;
    if (onlyFailing) {
      const failing = r.last_run?.status === 'failed' || r.last_run?.status === 'timeout';
      const stale = r.has_warning_alert || r.has_critical_alert;
      if (!failing && !stale) return false;
    }
    return true;
  }), [rows, onlyCritical, onlyFailing]);

  // ─── Column definitions ───────────────────────────────────────
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {row.original.is_critical_any && (
              <Icon icon={faStar} style={{ color: '#dc3545' }} title="Tabla crítica" />
            )}
            <Link href={`/admin/monitor/${encodeURIComponent(row.original.name)}`}>
              {row.original.name}
            </Link>
          </span>
        ),
      },
      {
        id: 'source',
        accessorFn: (r) => r.source?.name ?? '(sin fuente)',
        header: 'Fuente',
        filterFn: (row, _id, value) =>
          arrayIncludesAny([row.original.source?.name].filter(Boolean) as string[], value as string[]),
        cell: ({ row }) =>
          row.original.source ? (
            <Badge
              bg="light"
              text="dark"
              style={{ fontWeight: 500, border: '1px solid #d8d8e6' }}
              title={row.original.source.label}
            >
              {row.original.source.name}
            </Badge>
          ) : (
            <span style={{ color: '#bbb', fontStyle: 'italic' }}>(sin fuente)</span>
          ),
      },
      {
        id: 'severity',
        accessorKey: 'severity_default',
        header: 'Severity',
        filterFn: (row, _id, value) =>
          arrayIncludesAny([row.original.severity_default], value as string[]),
        cell: ({ getValue }) => (
          <Badge style={{ background: SEV_COLORS[getValue() as Severity], fontWeight: 500 }}>
            {String(getValue())}
          </Badge>
        ),
      },
      {
        id: 'categoryFirst',
        // First category alphabetically — used as a groupBy bucket so
        // grouping works even when a collector spans multiple categories.
        accessorFn: (r) => r.categories[0] ?? '(sin categoría)',
        header: 'Categorías',
        filterFn: (row, _id, value) => arrayIncludesAny(row.original.categories, value as string[]),
        cell: ({ row }) =>
          row.original.categories.length > 0 ? (
            <div>
              {row.original.categories.map((c) => (
                <Chip key={c} $color="#e7f1fb">{c}</Chip>
              ))}
            </div>
          ) : (
            <span style={{ color: '#bbb' }}>—</span>
          ),
      },
      {
        id: 'countryFirst',
        accessorFn: (r) => r.countries_data[0] ?? '(sin país)',
        header: 'País',
        filterFn: (row, _id, value) =>
          arrayIncludesAny(row.original.countries_data, value as string[]),
        cell: ({ row }) =>
          row.original.countries_data.length > 0 ? (
            <div>
              {row.original.countries_data.map((c) => (
                <Chip key={c} $color="#fff5e3">{c}</Chip>
              ))}
            </div>
          ) : (
            <span style={{ color: '#bbb' }}>—</span>
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
              {row.original.target_tables.map((t) => (
                <code key={t}>{t}</code>
              ))}
            </TableChips>
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
        id: 'duration',
        accessorFn: (r) => r.last_run?.duration_s ?? -1,
        header: 'Duración',
        cell: ({ row }) => formatDuration(row.original.last_run?.duration_s ?? null),
      },
      {
        id: 'rows',
        accessorFn: (r) => r.last_run?.rows_inserted ?? -1,
        header: 'Filas',
        cell: ({ row }) => formatRows(row.original.last_run?.rows_inserted),
      },
      {
        id: 'alerts',
        accessorKey: 'open_alerts',
        header: 'Alertas',
        cell: ({ getValue }) => {
          const v = Number(getValue());
          return v > 0 ? <Badge bg="danger">{v}</Badge> : <span style={{ color: '#ccc' }}>—</span>;
        },
      },
      {
        id: 'reviewWorst',
        accessorFn: (r) => worstReview(r),
        header: 'Estado revisión',
        sortingFn: (a, b) =>
          (REVIEW_PRIORITY[worstReview(b.original)] ?? 0) -
          (REVIEW_PRIORITY[worstReview(a.original)] ?? 0),
        cell: ({ row }) => <ReviewBar distribution={row.original.review_distribution} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) => (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <BsButton
              size="sm"
              variant="outline-primary"
              onClick={() => onDiagnose(row.original)}
              title="Abre el chat con un prompt pre-cargado para que el agente investigue este collector. NO modifica nada."
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              <Icon icon={faRobot} /> IA
            </BsButton>
            {row.original.last_run?.gh_run_url && (
              <a
                href={row.original.last_run.gh_run_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12 }}
              >
                GH <Icon icon={faArrowUpRightFromSquare} />
              </a>
            )}
          </span>
        ),
      },
    ],
    [onDiagnose],
  );

  // ─── TanStack column-filter state derived from toolbar dropdowns ──
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const out: ColumnFiltersState = [];
    if (sourceFilter.length > 0) out.push({ id: 'source', value: sourceFilter });
    if (severityFilter.length > 0) out.push({ id: 'severity', value: severityFilter });
    if (categoryFilter.length > 0) out.push({ id: 'categoryFirst', value: categoryFilter });
    if (countryFilter.length > 0) out.push({ id: 'countryFirst', value: countryFilter });
    return out;
  }, [sourceFilter, severityFilter, categoryFilter, countryFilter]);

  // ─── Derive grouping + expanded state from groupBy dropdown ───
  const grouping: GroupingState = useMemo(() => {
    const opt = GROUP_BY_OPTIONS.find((o) => o.key === groupBy);
    return opt?.columnId ? [opt.columnId] : [];
  }, [groupBy]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Auto-expand all groups when grouping turns on so users see content
  // immediately. They can collapse manually.
  React.useEffect(() => {
    if (grouping.length === 0) {
      setExpanded({});
    } else {
      setExpanded(true);
    }
  }, [grouping.length]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: {
      globalFilter,
      columnFilters,
      grouping,
      sorting,
      expanded,
    },
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

  // ─── Render ───────────────────────────────────────────────────
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

        {/* MultiSelect is a custom button-based widget (not a native form control)
            so we wrap each in <span>, not <label>, to satisfy
            jsx-a11y/label-has-associated-control. */}
        <span className="inline">
          Fuente
          <MultiSelect options={optionSets.sources} value={sourceFilter} onChange={setSourceFilter} />
        </span>

        <span className="inline">
          Categoría
          <MultiSelect options={optionSets.categories} value={categoryFilter} onChange={setCategoryFilter} />
        </span>

        <span className="inline">
          País
          <MultiSelect options={optionSets.countries} value={countryFilter} onChange={setCountryFilter} />
        </span>

        <span className="inline">
          Severity
          <MultiSelect
            options={['critical', 'warning', 'info']}
            value={severityFilter}
            onChange={setSeverityFilter}
          />
        </span>

        <label className="inline">
          Agrupar
          <Form.Select
            size="sm"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
            style={{ minWidth: 170 }}
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </Form.Select>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyCritical}
            onChange={(e) => setOnlyCritical(e.target.checked)}
          />
          Solo críticos
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyFailing}
            onChange={(e) => setOnlyFailing(e.target.checked)}
          />
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
                  <tr
                    key={row.id}
                    className="group-header"
                    onClick={row.getToggleExpandedHandler()}
                  >
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
                <td
                  colSpan={colCount}
                  style={{ textAlign: 'center', color: '#999', padding: 32, fontSize: 13 }}
                >
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
