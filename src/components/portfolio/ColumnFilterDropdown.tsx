/* eslint-disable react/jsx-props-no-spreading, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */

'use client';

/**
 * Dropdown tipo Excel para filtrar y ordenar una columna del BlotterTable.
 *
 * Renderiza un boton "▾" pequeno al lado del titulo de la columna. Al
 * abrirlo muestra:
 *   - Botones de ordenamiento (A→Z, Z→A, Quitar orden)
 *   - Buscador (filtro por texto sobre los valores distintos)
 *   - Checkboxes con los valores distintos de la columna en TODA la data
 *   - Botones Aplicar / Limpiar
 *
 * El filtro se aplica via TanStack Table (`column.setFilterValue(string[])`).
 * El filterFn estandar (en BlotterTable) revisa si el valor de la fila esta
 * en el array filterValue. Si filterValue esta vacio o undefined, no filtra.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Column } from '@tanstack/react-table';

// Estilos compartidos (declarados antes del componente para que el linter
// no se queje de no-use-before-define).
const sortBtnStyle = (active: boolean): React.CSSProperties => ({
  textAlign: 'left',
  padding: '4px 8px',
  fontSize: 11,
  background: active ? '#cfe2ff' : 'transparent',
  color: active ? '#084298' : '#212529',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
});

const miniBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  background: '#fff',
  border: '1px solid #ced4da',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#212529',
};

interface Props<T> {
  column: Column<T, unknown>;
  // Todas las filas de la tabla (sin filtrar). Usadas para construir los
  // valores distintos del dropdown.
  rows: T[];
  // Como extraer el valor visible/filtrable de cada fila.
  accessor: (r: T) => string | number | null | undefined;
  // Opcional: como formatear el valor para mostrarlo en la lista
  formatValue?: (v: string | number) => string;
}

export default function ColumnFilterDropdown<T>({
  column, rows, accessor, formatValue,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Borrador local de seleccion. Solo se aplica al column.setFilterValue
  // cuando el usuario clickea "Aplicar". Inicializa con el filtro actual
  // o con TODOS los valores distintos si no hay filtro activo.
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Valores distintos de TODA la tabla, ordenados.
  const distinctValues = useMemo(() => {
    const set = rows.reduce<Set<string>>((acc, r) => {
      const v = accessor(r);
      if (v != null && v !== '') acc.add(String(v));
      return acc;
    }, new Set<string>());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [rows, accessor]);

  // Filtra los valores distintos por el search box.
  const visibleValues = useMemo(() => {
    if (!search.trim()) return distinctValues;
    const q = search.toLowerCase();
    return distinctValues.filter((v) => v.toLowerCase().includes(q));
  }, [distinctValues, search]);

  const currentFilter = column.getFilterValue() as string[] | undefined;
  const isFiltered = Array.isArray(currentFilter) && currentFilter.length > 0
    && currentFilter.length < distinctValues.length;

  // Cuando se abre el dropdown, hidrata el draft con el filtro actual o con
  // todo seleccionado si no hay filtro.
  useEffect(() => {
    if (!open) return;
    if (Array.isArray(currentFilter) && currentFilter.length > 0) {
      setDraft(new Set(currentFilter));
    } else {
      setDraft(new Set(distinctValues));
    }
    setSearch('');
  }, [open, distinctValues, currentFilter]);

  // Cierra al click fuera o ESC.
  //
  // Importante: el listener de mousedown se REGISTRA con un setTimeout(0)
  // — sin eso, el mismo click que abre el dropdown (que llega aqui via el
  // onClick sintetico de React) hace que React re-renderee + useEffect corra
  // + addEventListener registre el listener ANTES de que el event loop
  // termine de propagar el mousedown nativo, y entonces el listener atrapa
  // el mismo mousedown y cierra el dropdown inmediatamente. El setTimeout
  // empuja el registro al siguiente tick, despues del mousedown actual.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const registerId = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(registerId);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleValue = useCallback((v: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }, []);

  const applyFilter = useCallback(() => {
    // Si esta TODO seleccionado, equivale a no filtrar.
    if (draft.size === distinctValues.length) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue(Array.from(draft));
    }
    setOpen(false);
  }, [draft, distinctValues.length, column]);

  const clearFilter = useCallback(() => {
    column.setFilterValue(undefined);
    setOpen(false);
  }, [column]);

  const sortAsc = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    column.toggleSorting(false);
  }, [column]);
  const sortDesc = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    column.toggleSorting(true);
  }, [column]);
  const sortClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    column.clearSorting();
  }, [column]);

  const currentSort = column.getIsSorted();

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={isFiltered ? 'Filtro activo — clic para ajustar' : 'Filtrar / Ordenar'}
        style={{
          background: isFiltered ? '#0d6efd' : 'transparent',
          color: isFiltered ? '#fff' : '#6c757d',
          border: 'none',
          fontSize: 11,
          cursor: 'pointer',
          padding: '0 4px',
          borderRadius: 3,
          lineHeight: 1,
        }}
      >
        ▾
      </button>
      {open && (
        <div
          // El stopPropagation impide que clicks dentro del menu disparen
          // el drag/sort handler del header.
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #ced4da',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            minWidth: 220,
            padding: 8,
            fontSize: 12,
            color: '#212529',
            fontWeight: 400,
            textAlign: 'left',
          }}
        >
          {/* Bloque de ordenamiento */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            <button
              type="button"
              onClick={sortAsc}
              style={sortBtnStyle(currentSort === 'asc')}
            >
              ↑ Ordenar A → Z (menor a mayor)
            </button>
            <button
              type="button"
              onClick={sortDesc}
              style={sortBtnStyle(currentSort === 'desc')}
            >
              ↓ Ordenar Z → A (mayor a menor)
            </button>
            {currentSort && (
              <button
                type="button"
                onClick={sortClear}
                style={{ ...sortBtnStyle(false), color: '#dc3545' }}
              >
                ⨯ Quitar orden
              </button>
            )}
          </div>

          <hr style={{ margin: '6px 0', borderColor: '#e9ecef' }} />

          {/* Buscador */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            style={{
              width: '100%', padding: '4px 6px', fontSize: 11,
              border: '1px solid #ced4da', borderRadius: 4, marginBottom: 6,
            }}
          />

          {/* Acciones rapidas */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setDraft(new Set(visibleValues))}
              style={miniBtnStyle}
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={() => setDraft(new Set())}
              style={miniBtnStyle}
            >
              Desmarcar todos
            </button>
          </div>

          {/* Lista de valores */}
          <div style={{
            maxHeight: 200, overflowY: 'auto',
            border: '1px solid #e9ecef', borderRadius: 4, padding: 4,
            marginBottom: 8,
          }}
          >
            {visibleValues.length === 0 && (
              <div style={{ color: '#6c757d', fontStyle: 'italic', padding: 4 }}>
                Sin coincidencias
              </div>
            )}
            {visibleValues.map((v) => (
              <label
                key={v}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 4px', cursor: 'pointer', userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.has(v)}
                  onChange={() => toggleValue(v)}
                />
                <span style={{ fontSize: 11 }}>
                  {formatValue ? formatValue(v) : v}
                </span>
              </label>
            ))}
          </div>

          {/* Botones de accion */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button type="button" onClick={clearFilter} style={miniBtnStyle}>
              Limpiar
            </button>
            <button
              type="button"
              onClick={applyFilter}
              style={{
                ...miniBtnStyle,
                background: '#0d6efd',
                color: '#fff',
                borderColor: '#0d6efd',
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
