'use client';

// Catálogo de datos — overview page (Phase 2 of the catalog plan).
// Visible to any authenticated user. Lists every table in
// xerenity.data_tables_meta with: category, country, sources writing,
// number of consumers reading, slice value coverage. Click a row to
// drill into /data-catalog/<table_name>.

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { Badge, Form } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { CoreLayout } from '@layout';
import PageTitle from '@components/PageTitle';
import { listDataCatalogOverview } from 'src/models/dataCatalog';
import type { DataCatalogOverviewEntry } from 'src/types/catalog';

// ─────────────────────────────────────────────────────────────────
// Styled
// ─────────────────────────────────────────────────────────────────

const PageWrap = styled.div`
  padding: 16px 24px;
`;

const Toolbar = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;

  .label-inline {
    font-size: 11px;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-right: 4px;
  }

  .search-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 4px 8px;
    background: #fff;
    flex: 1 1 240px;
    max-width: 360px;

    input {
      border: none;
      outline: none;
      width: 100%;
      font-size: 13px;
    }
  }
`;

const TableWrap = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow-x: auto;

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
    cursor: pointer;
    user-select: none;
  }
  thead th:hover { background: #3d3680; }
  tbody td {
    font-size: 13px;
    padding: 9px 12px;
    border-bottom: 1px solid #f1f1f4;
    vertical-align: middle;
  }
  tbody tr:hover { background: rgba(48, 43, 99, 0.04); cursor: pointer; }
  a {
    color: #302b63;
    text-decoration: none;
    font-weight: 600;
  }
  a:hover { text-decoration: underline; }
  code {
    font-family: monospace;
    background: #f3f3f7;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
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

const InfoBox = styled.div`
  background: #f3f3f7;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #555;

  strong { color: #302b63; }
`;

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

type SortKey =
  | 'table_name'
  | 'category'
  | 'country'
  | 'n_collectors_writing'
  | 'n_consumers';

const DataCatalogPage = () => {
  const [rows, setRows] = useState<DataCatalogOverviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [onlyCritical, setOnlyCritical] = useState(false);

  const [sortBy, setSortBy] = useState<SortKey>('table_name');
  const [sortDesc, setSortDesc] = useState(false);

  useEffect(() => {
    listDataCatalogOverview().then((res) => {
      if (res.data) setRows(res.data);
      if (res.error) setError(res.error);
      setLoading(false);
    });
  }, []);

  // Distinct option sets for filters
  const optionSets = useMemo(() => {
    const cats = new Set<string>();
    const countries = new Set<string>();
    const sources = new Set<string>();
    rows.forEach((r) => {
      if (r.category) cats.add(r.category);
      if (r.country) countries.add(r.country);
      r.sources.forEach((s) => sources.add(s));
    });
    return {
      categories: Array.from(cats).sort(),
      countries: Array.from(countries).sort(),
      sources: Array.from(sources).sort(),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlyCritical && !r.is_critical) return false;
        if (categoryFilter && r.category !== categoryFilter) return false;
        if (countryFilter && r.country !== countryFilter) return false;
        if (sourceFilter && !r.sources.includes(sourceFilter)) return false;
        if (!q) return true;
        const haystack = [
          r.table_name,
          r.label ?? '',
          r.description ?? '',
          r.category ?? '',
          r.country ?? '',
          ...r.sources,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const av = a[sortBy] ?? '';
        const bv = b[sortBy] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDesc ? -cmp : cmp;
      });
  }, [rows, search, categoryFilter, countryFilter, sourceFilter, onlyCritical, sortBy, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(key);
      setSortDesc(false);
    }
  };

  return (
    <CoreLayout>
      <PageWrap>
        <PageTitle>Catálogo de datos</PageTitle>

        <InfoBox>
          <strong>{rows.length}</strong> tablas registradas en el catálogo de Xerenity.
          Buscá por nombre, categoría o fuente; click en una fila para ver detalle
          (descripción, columnas, valores, quién la pobla y quién la lee).
        </InfoBox>

        <Toolbar>
          <div className="search-wrap">
            <Icon icon={faSearch} style={{ color: '#888' }} />
            <input
              type="text"
              placeholder="Buscar tabla, descripción, fuente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <span className="label-inline">Categoría</span>
          <Form.Select
            size="sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Todas</option>
            {optionSets.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>

          <span className="label-inline">País</span>
          <Form.Select
            size="sm"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Todos</option>
            {optionSets.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>

          <span className="label-inline">Fuente</span>
          <Form.Select
            size="sm"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Todas</option>
            {optionSets.sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Form.Select>

          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#444', cursor: 'pointer',
            padding: '4px 8px', background: '#f3f3f7', borderRadius: 4,
          }}>
            <input
              type="checkbox"
              checked={onlyCritical}
              onChange={(e) => setOnlyCritical(e.target.checked)}
              style={{ margin: 0 }}
            />
            Solo críticas
          </label>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>
            {filtered.length} de {rows.length} tablas
          </span>
        </Toolbar>

        {loading && <em style={{ color: '#888' }}>Cargando catálogo…</em>}
        {error && (
          <div style={{ color: '#dc3545', padding: 12, background: '#fdf3f4', borderRadius: 4 }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('table_name')}>Tabla {sortBy === 'table_name' && (sortDesc ? '▾' : '▴')}</th>
                  <th>Label</th>
                  <th onClick={() => toggleSort('category')}>Categoría {sortBy === 'category' && (sortDesc ? '▾' : '▴')}</th>
                  <th onClick={() => toggleSort('country')}>País {sortBy === 'country' && (sortDesc ? '▾' : '▴')}</th>
                  <th>Fuentes</th>
                  <th onClick={() => toggleSort('n_collectors_writing')}>Writers {sortBy === 'n_collectors_writing' && (sortDesc ? '▾' : '▴')}</th>
                  <th onClick={() => toggleSort('n_consumers')}>Consumers {sortBy === 'n_consumers' && (sortDesc ? '▾' : '▴')}</th>
                  <th>Slice values</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.table_name} onClick={() => { window.location.href = `/data-catalog/${encodeURIComponent(r.table_name)}`; }}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {r.is_critical && (
                          <Icon icon={faStar} style={{ color: '#dc3545' }} title="Tabla crítica" />
                        )}
                        <Link href={`/data-catalog/${encodeURIComponent(r.table_name)}`} onClick={(e) => e.stopPropagation()}>
                          {r.table_name}
                        </Link>
                      </span>
                    </td>
                    <td style={{ color: '#555' }}>{r.label ?? <em style={{ color: '#bbb' }}>—</em>}</td>
                    <td>{r.category ? <Chip $color="#e7f1fb">{r.category}</Chip> : <em style={{ color: '#bbb' }}>—</em>}</td>
                    <td>{r.country ? <Chip $color="#fff5e3">{r.country}</Chip> : <em style={{ color: '#bbb' }}>—</em>}</td>
                    <td>
                      {r.sources.length > 0 ? (
                        r.sources.map((s) => <Chip key={s} $color="#f3f3f7">{s}</Chip>)
                      ) : (
                        <em style={{ color: '#bbb' }}>—</em>
                      )}
                    </td>
                    <td>
                      <Badge bg={r.n_collectors_writing > 0 ? 'primary' : 'secondary'}>
                        {r.n_collectors_writing}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={r.n_consumers > 0 ? 'success' : 'secondary'}>
                        {r.n_consumers}
                      </Badge>
                    </td>
                    <td>
                      {r.n_slice_values > 0 ? (
                        <span style={{ fontSize: 11, color: '#666' }}>{r.n_slice_values} valores</span>
                      ) : (
                        <em style={{ color: '#bbb', fontSize: 11 }}>—</em>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: 32 }}>
                      Sin tablas que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </PageWrap>
    </CoreLayout>
  );
};

export default DataCatalogPage;
