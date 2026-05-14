'use client';

// Shared DictionaryBlock — collapsible columns + slice values for a single
// table from the catalog. Used by /data-catalog/[table] (Phase 2). The
// monitor's _CatalogTab.tsx keeps its own inline copy because adding a
// new import from src/components/ into src/pages/admin/monitor/ has been
// known to break Vercel builds opaquely. This component lives at
// src/components/dataCatalog/ and is only imported from /data-catalog/
// pages, which has been a safe path.

import React, { useState } from 'react';
import styled from 'styled-components';
import { Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import type { DataColumnMeta, DataSliceEntry } from 'src/types/catalog';

const Wrap = styled.div`
  margin-top: 12px;
`;

const Toggle = styled.button<{ $open: boolean }>`
  background: ${(p) => (p.$open ? '#fafaff' : 'transparent')};
  border: 1px solid #e0e0e8;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #302b63;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  &:hover {
    background: #f3f3f7;
  }
`;

const SubTable = styled.table`
  width: 100%;
  margin-bottom: 12px;
  border-collapse: collapse;

  thead th {
    background: #fafaff;
    font-size: 10px;
    text-transform: uppercase;
    color: #555;
    font-weight: 600;
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: top;
    font-size: 12px;
  }
  tbody tr:hover { background: rgba(48, 43, 99, 0.03); }
  code {
    font-family: monospace;
    background: #f3f3f7;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
  }
`;

interface Props {
  columns: DataColumnMeta[];
  slices: DataSliceEntry[];
  defaultOpenColumns?: boolean;
  defaultOpenSlices?: boolean;
}

const DictionaryBlock: React.FC<Props> = ({
  columns,
  slices,
  defaultOpenColumns = false,
  defaultOpenSlices = false,
}) => {
  const [showColumns, setShowColumns] = useState(defaultOpenColumns);
  const [showSlices, setShowSlices] = useState(defaultOpenSlices);

  if (columns.length === 0 && slices.length === 0) {
    return (
      <Wrap>
        <em style={{ color: '#bbb', fontSize: 12 }}>
          Sin diccionario de columnas ni valores. Las columnas se auto-detectan
          desde information_schema cuando la tabla está registrada en data_tables_meta.
        </em>
      </Wrap>
    );
  }

  return (
    <Wrap>
      {columns.length > 0 && (
        <>
          <Toggle type="button" onClick={() => setShowColumns((v) => !v)} $open={showColumns}>
            <Icon icon={showColumns ? faChevronDown : faChevronRight} />
            Columnas ({columns.length})
          </Toggle>
          {showColumns && (
            <SubTable>
              <thead>
                <tr>
                  <th>Columna</th>
                  <th>Tipo</th>
                  <th>Label</th>
                  <th>Descripción</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c) => (
                  <tr key={c.column_name}>
                    <td>
                      <code>{c.column_name}</code>
                      {c.is_date_key && <Badge bg="info" style={{ marginLeft: 4, fontSize: 9 }}>date</Badge>}
                      {c.is_slice_key && <Badge bg="warning" style={{ marginLeft: 4, fontSize: 9, color: '#000' }}>slice</Badge>}
                    </td>
                    <td style={{ color: '#888', fontSize: 11 }}>{c.data_type}</td>
                    <td>{c.label ?? <em style={{ color: '#bbb' }}>—</em>}</td>
                    <td style={{ fontSize: 11, color: '#555' }}>{c.description ?? <em style={{ color: '#bbb' }}>—</em>}</td>
                    <td>{c.unit ?? <em style={{ color: '#bbb' }}>—</em>}</td>
                  </tr>
                ))}
              </tbody>
            </SubTable>
          )}
        </>
      )}

      {slices.length > 0 && (
        <>
          <Toggle type="button" onClick={() => setShowSlices((v) => !v)} $open={showSlices}>
            <Icon icon={showSlices ? faChevronDown : faChevronRight} />
            Slice dictionary ({slices.length})
          </Toggle>
          {showSlices && (
            <SubTable>
              <thead>
                <tr>
                  <th>Valor</th>
                  <th>Label</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s) => (
                  <tr key={s.slice_value}>
                    <td><code>{s.slice_value}</code></td>
                    <td style={{ fontWeight: 500 }}>{s.label}</td>
                    <td style={{ fontSize: 11, color: '#555' }}>{s.description ?? <em style={{ color: '#bbb' }}>—</em>}</td>
                  </tr>
                ))}
              </tbody>
            </SubTable>
          )}
        </>
      )}
    </Wrap>
  );
};

export default DictionaryBlock;
