'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Badge, Form, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faDatabase,
  faPeopleArrows,
  faPenToSquare,
  faStar,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import useAppStore from 'src/store';
import type {
  CollectorTableSeries,
  CollectorRunStatRecent,
  SliceBreakdown,
  ReviewStatus,
  HealthStatus,
  CollectorFullDetail,
  CollectorDictionary,
  DataColumnMeta,
  DataSliceEntry,
} from 'src/types/catalog';

// ─────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────

const Section = styled.section`
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;
`;

const SectionHeader = styled.h4`
  font-size: 14px;
  font-weight: 700;
  color: #302b63;
  margin: 0 0 14px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const KeyValueGrid = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  font-size: 13px;
  margin: 0;
  dt { font-weight: 600; color: #555; }
  dd { margin: 0; word-break: break-word; }
  code { font-family: monospace; background: #f3f3f7; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  a { color: #302b63; }
`;

const SubTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 8px;
  thead th {
    background: #fafaff;
    text-transform: uppercase;
    color: #555;
    font-size: 10px;
    font-weight: 600;
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: middle;
  }
  tbody tr:hover { background: rgba(48, 43, 99, 0.03); }
`;

const TableBlock = styled.div`
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: #fcfcff;

  &.is-critical {
    border-left: 4px solid #dc3545;
    background: #fff8f8;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .table-name code { font-family: monospace; font-weight: 600; }
  .table-meta { font-size: 11px; color: #888; }
`;

const HEALTH_BG: Record<HealthStatus, string> = {
  healthy: '#d4edda',
  degraded: '#fff3cd',
  down: '#f8d7da',
  unknown: '#e9ecef',
};
const HEALTH_FG: Record<HealthStatus, string> = {
  healthy: '#155724',
  degraded: '#856404',
  down: '#721c24',
  unknown: '#495057',
};

const HealthBadge = styled.span<{ $status: HealthStatus }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${(p) => HEALTH_BG[p.$status]};
  color: ${(p) => HEALTH_FG[p.$status]};
`;

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pendiente: 'Pendiente',
  mantener: 'Mantener',
  arreglar: 'Arreglar',
  deprecar: 'Deprecar',
  documentar: 'Documentar',
};

const REVIEW_BG: Record<ReviewStatus, string> = {
  pendiente: '#e9ecef',
  mantener: '#28a745',
  arreglar: '#f0ad4e',
  deprecar: '#dc3545',
  documentar: '#5bc0de',
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'sin fecha';
  const ms = Date.now() - new Date(iso).getTime();
  const days = ms / 86400000;
  if (days < 1) {
    const hours = Math.round(ms / 3600000);
    return `hace ${hours}h`;
  }
  if (days < 30) return `hace ${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `hace ${months.toFixed(1)} meses`;
  return `hace ${(months / 12).toFixed(1)} años`;
};

const formatCadence = (days: number | null): string => {
  if (days === null || days === undefined) return '—';
  if (days < 1) return `~${(days * 24).toFixed(1)}h`;
  if (days < 5) return `~${days.toFixed(1)}d`;
  if (days < 14) return `~${days.toFixed(0)}d (semanal?)`;
  if (days < 60) return `~${days.toFixed(0)}d (mensual?)`;
  return `~${days.toFixed(0)}d`;
};

const isErrorRow = (row: SliceBreakdown | { error: string }): row is { error: string } =>
  'error' in row;


// ─────────────────────────────────────────────────────────────────
// Inline-edit helpers
// ─────────────────────────────────────────────────────────────────

function useDebouncedSave<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<{ ok: boolean; error?: string }>,
  delayMs = 800,
) {
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (...args: TArgs) => {
    setSavingState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fn(...args);
      if (res.ok) {
        setSavingState('saved');
        setSavedAt(Date.now());
      } else {
        setSavingState('error');
        toast.error(res.error ?? 'Error al guardar');
      }
    }, delayMs);
  };

  return { schedule, savingState, savedAt };
}


// ─────────────────────────────────────────────────────────────────
// Sub-sections
// ─────────────────────────────────────────────────────────────────

const SaveStatus: React.FC<{
  savingState: 'idle' | 'saving' | 'saved' | 'error';
  savedAt: number | null;
}> = ({ savingState, savedAt }) => {
  if (savingState === 'idle') return null;
  return (
    <div style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      {savingState === 'saving' && (
        <><Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} /> Guardando…</>
      )}
      {savingState === 'saved' && savedAt && (
        <><Icon icon={faCircleCheck} style={{ color: '#28a745' }} /> Guardado {formatRelative(new Date(savedAt).toISOString())}</>
      )}
      {savingState === 'error' && (
        <><Icon icon={faCircleXmark} style={{ color: '#dc3545' }} /> Error al guardar</>
      )}
    </div>
  );
};

const ReviewBlock: React.FC<{
  collectorName: string;
  tableName: string;
  review: { review_status: ReviewStatus; notes: string | null; reviewed_at: string | null; reviewed_by_email: string | null } | undefined;
  save: (collectorName: string, tableName: string, status: ReviewStatus, notes: string | null) => Promise<{ ok: boolean; error?: string }>;
}> = ({ collectorName, tableName, review, save }) => {
  const [statusDraft, setStatusDraft] = useState<ReviewStatus>(review?.review_status ?? 'pendiente');
  const [notesDraft, setNotesDraft] = useState(review?.notes ?? '');

  useEffect(() => {
    setStatusDraft(review?.review_status ?? 'pendiente');
    setNotesDraft(review?.notes ?? '');
  }, [review?.review_status, review?.notes]);

  const { schedule, savingState, savedAt } = useDebouncedSave(
    (s: ReviewStatus, n: string | null) => save(collectorName, tableName, s, n),
  );

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #ddd' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase' }}>Estado de revisión:</span>
        <Form.Select
          size="sm"
          value={statusDraft}
          onChange={(e) => {
            const v = e.target.value as ReviewStatus;
            setStatusDraft(v);
            schedule(v, notesDraft || null);
          }}
          style={{ maxWidth: 180, display: 'inline-block' }}
        >
          {(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((k) => (
            <option key={k} value={k}>{REVIEW_LABELS[k]}</option>
          ))}
        </Form.Select>
        <Badge style={{ background: REVIEW_BG[statusDraft] }}>
          {REVIEW_LABELS[statusDraft]}
        </Badge>
        {review?.reviewed_at && review.reviewed_by_email && (
          <span style={{ fontSize: 11, color: '#888' }}>
            Última: {formatRelative(review.reviewed_at)} por {review.reviewed_by_email}
          </span>
        )}
      </div>
      <Form.Control
        as="textarea"
        rows={2}
        placeholder="Notas sobre esta tabla específica (selectores, filtros, decisiones)…"
        value={notesDraft}
        onChange={(e) => {
          setNotesDraft(e.target.value);
          schedule(statusDraft, e.target.value || null);
        }}
        style={{ fontSize: 12 }}
      />
      <SaveStatus savingState={savingState} savedAt={savedAt} />
    </div>
  );
};

const OrigenSection: React.FC<{ collectorName: string }> = ({ collectorName }) => {
  const { detail, sources, save, loadRegistries } = useAppStore((s) => ({
    detail: s.catalogDetail[collectorName],
    sources: s.catalogSources,
    save: s.saveCollectorMetadata,
    loadRegistries: s.loadCatalogRegistries,
  }));

  useEffect(() => {
    if (sources.length === 0) loadRegistries();
  }, [sources.length, loadRegistries]);

  const [notesDraft, setNotesDraft] = useState(detail?.definition.notes ?? '');
  const [sourceDraft, setSourceDraft] = useState(detail?.definition.source_name ?? '');

  useEffect(() => {
    setNotesDraft(detail?.definition.notes ?? '');
    setSourceDraft(detail?.definition.source_name ?? '');
  }, [detail?.definition.notes, detail?.definition.source_name]);

  const { schedule, savingState, savedAt } = useDebouncedSave(
    (newSource: string | null, newNotes: string | null) =>
      save(collectorName, newSource, newNotes),
  );

  if (!detail) return null;
  const src = detail.source;

  return (
    <Section>
      <SectionHeader><Icon icon={faGlobe} /> Origen</SectionHeader>
      <KeyValueGrid>
        <dt>Fuente:</dt>
        <dd>
          <Form.Select
            size="sm"
            value={sourceDraft || ''}
            onChange={(e) => {
              const v = e.target.value || null;
              setSourceDraft(v ?? '');
              schedule(v, notesDraft || null);
            }}
            style={{ maxWidth: 360, display: 'inline-block' }}
          >
            <option value="">— Sin fuente asignada —</option>
            {sources.map((s) => (
              <option key={s.name} value={s.name}>
                {s.label} ({s.country ?? '?'})
              </option>
            ))}
          </Form.Select>
        </dd>

        {src && (
          <>
            <dt>País:</dt>           <dd>{src.country ?? '—'}</dd>
            <dt>Tipo de pull:</dt>   <dd><code>{src.source_type ?? '—'}</code></dd>
            <dt>URL:</dt>            <dd>{src.base_url ? <a href={src.base_url} target="_blank" rel="noreferrer">{src.base_url}</a> : '—'}</dd>
            <dt>Publish:</dt>        <dd>{src.publish_schedule ?? '—'}</dd>
            <dt>Health:</dt>         <dd><HealthBadge $status={src.health_status}>{src.health_status}</HealthBadge></dd>
          </>
        )}
      </KeyValueGrid>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#555', marginBottom: 4 }}>
          Notas del collector <Icon icon={faPenToSquare} style={{ fontSize: 10, color: '#bbb' }} />
        </div>
        <Form.Control
          as="textarea"
          rows={3}
          placeholder="Notas operativas, gotchas, historial de decisiones (markdown plano)…"
          value={notesDraft}
          onChange={(e) => {
            setNotesDraft(e.target.value);
            schedule(sourceDraft || null, e.target.value || null);
          }}
          style={{ fontSize: 13 }}
        />
        <SaveStatus savingState={savingState} savedAt={savedAt} />
      </div>
    </Section>
  );
};

// DictionaryBlock — collapsible columns + slice values for a single target
// table. Collapsed by default so the catalog tab doesn't overwhelm; click to
// expand. Pure render off the dictionary prop coming from get_collector_full_detail.
const DictionaryBlock: React.FC<{
  columns: DataColumnMeta[];
  slices: DataSliceEntry[];
}> = ({ columns, slices }) => {
  const [showColumns, setShowColumns] = useState(false);
  const [showSlices, setShowSlices] = useState(false);

  if (columns.length === 0 && slices.length === 0) return null;

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e0e0e8' }}>
      {columns.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              cursor: 'pointer',
            }}
          >
            <Icon icon={showColumns ? faCircleCheck : faCircleExclamation}
              style={{ fontSize: 9, marginRight: 4, opacity: 0.4 }} />
            Columnas ({columns.length}){showColumns ? ' ▾' : ' ▸'}
          </button>
          {showColumns && (
            <SubTable style={{ marginTop: 6 }}>
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
        </div>
      )}

      {slices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowSlices((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              cursor: 'pointer',
            }}
          >
            <Icon icon={showSlices ? faCircleCheck : faCircleExclamation}
              style={{ fontSize: 9, marginRight: 4, opacity: 0.4 }} />
            Slice dictionary ({slices.length}){showSlices ? ' ▾' : ' ▸'}
          </button>
          {showSlices && (
            <SubTable style={{ marginTop: 6 }}>
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
        </div>
      )}
    </div>
  );
};

const SeriesSection: React.FC<{
  series: CollectorTableSeries[];
  collectorName: string;
  dictionary: CollectorDictionary | null;
}> = ({ series, collectorName, dictionary }) => {
  const { detail, save } = useAppStore((s) => ({
    detail: s.catalogDetail[collectorName],
    save: s.saveCollectorTableReview,
  }));
  const reviewByTable = useMemo(() => {
    const map: Record<string, typeof detail.reviews[number]> = {};
    detail?.reviews.forEach((r) => { map[r.table_name] = r; });
    return map;
  }, [detail]);

  return (
    <Section>
      <SectionHeader><Icon icon={faDatabase} /> Series por tabla destino</SectionHeader>
      {series.length === 0 && (
        <div style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
          Este collector no tiene tablas destino registradas.
        </div>
      )}
      {series.map((s) => (
        <TableBlock key={s.table_name} className={s.is_critical ? 'is-critical' : ''}>
          <div className="header-row">
            <div className="table-name">
              {s.is_critical && (
                <Icon icon={faStar} style={{ color: '#dc3545', marginRight: 6 }} />
              )}
              <code>{s.table_name}</code>
              {s.label && <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>{s.label}</span>}
            </div>
            <div className="table-meta">
              {s.country && <Badge bg="secondary" style={{ marginRight: 6 }}>{s.country}</Badge>}
              {s.category && <Badge bg="info">{s.category}</Badge>}
            </div>
          </div>

          {!s.meta_present && (
            <div style={{ color: '#dc3545', fontSize: 12, padding: '8px 0' }}>
              ⚠ Tabla no registrada en data_tables_meta. Agregar en una migración futura.
            </div>
          )}

          {s.meta_present && s.slices.length === 0 && (
            <div style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>
              Sin filas en la tabla.
            </div>
          )}

          {s.meta_present && s.slices.length > 0 && isErrorRow(s.slices[0]) && (
            <div style={{ color: '#dc3545', fontSize: 12 }}>
              Error calculando series: {(s.slices[0] as { error: string }).error}
            </div>
          )}

          {s.meta_present && s.slices.length > 0 && !isErrorRow(s.slices[0]) && (
            <SubTable>
              <thead>
                <tr>
                  <th>Slice {s.slice_column ? <code>{s.slice_column}</code> : ''}</th>
                  <th>Última fecha</th>
                  <th>Filas</th>
                  <th>Cadencia obs.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(s.slices as SliceBreakdown[]).map((slice) => {
                  const lastDate = slice.last_date;
                  let statusIcon = <Icon icon={faCircleCheck} style={{ color: '#28a745' }} />;
                  let statusText = 'fresca';
                  if (lastDate) {
                    const ageDays = (Date.now() - new Date(lastDate).getTime()) / 86400000;
                    if (ageDays > 14) {
                      statusIcon = <Icon icon={faCircleXmark} style={{ color: '#dc3545' }} />;
                      statusText = `stale ${Math.round(ageDays)}d`;
                    } else if (ageDays > 3) {
                      statusIcon = <Icon icon={faCircleExclamation} style={{ color: '#f0ad4e' }} />;
                      statusText = `${Math.round(ageDays)}d`;
                    }
                  } else {
                    statusIcon = <Icon icon={faCircleXmark} style={{ color: '#dc3545' }} />;
                    statusText = 'sin datos';
                  }
                  return (
                    <tr key={slice.slice_value}>
                      <td><code>{slice.slice_value}</code></td>
                      <td>{lastDate ?? '—'}</td>
                      <td>{slice.row_count.toLocaleString()}</td>
                      <td>{formatCadence(slice.cadence_days)}</td>
                      <td>{statusIcon} <span style={{ fontSize: 11, color: '#666' }}>{statusText}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </SubTable>
          )}

          {/* Columns + slice dictionary — collapsible per table */}
          <DictionaryBlock
            columns={dictionary?.[s.table_name]?.columns ?? []}
            slices={dictionary?.[s.table_name]?.slices ?? []}
          />

          {/* Per-(collector, table) review */}
          <ReviewBlock
            collectorName={collectorName}
            tableName={s.table_name}
            review={reviewByTable[s.table_name]}
            save={save}
          />
        </TableBlock>
      ))}
    </Section>
  );
};

const ConsumidoresSection: React.FC<{ consumers: { name: string; consumer_type: string; label: string; path: string | null; reads_tables: string[]; writes_tables: string[] }[] }> = ({ consumers }) => (
  <Section>
    <SectionHeader>
      <Icon icon={faPeopleArrows} /> Consumidores ({consumers.length})
    </SectionHeader>
    {consumers.length === 0 ? (
      <div style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
        Ningún consumidor registrado leyendo las tablas de este collector. La página /admin/data-catalog (próximamente) permitirá registrarlos.
      </div>
    ) : (
      <SubTable>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Nombre</th>
            <th>Path</th>
            <th>Lee tablas</th>
            <th>Escribe tablas</th>
          </tr>
        </thead>
        <tbody>
          {consumers.map((c) => (
            <tr key={c.name}>
              <td><Badge bg="secondary" style={{ fontSize: 10 }}>{c.consumer_type}</Badge></td>
              <td><strong>{c.label}</strong></td>
              <td style={{ color: '#666', fontFamily: 'monospace', fontSize: 11 }}>{c.path ?? '—'}</td>
              <td style={{ fontSize: 11 }}>{c.reads_tables.length > 0 ? c.reads_tables.join(', ') : '—'}</td>
              <td style={{ fontSize: 11 }}>
                {c.writes_tables.length > 0 ? (
                  <Badge bg="warning" text="dark" style={{ fontSize: 10 }}>
                    ⭐ escribe {c.writes_tables.join(', ')}
                  </Badge>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </SubTable>
    )}
  </Section>
);


// ─────────────────────────────────────────────────────────────────
// Top-level CatalogTab
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// SaludSection — top-of-tab health digest.
//
// Surfaces the same diagnostic signals a triager would otherwise
// compute from SQL: human-readable cron, expected cadence vs latest
// data, success/empty/failure rate over the last 30 runs, sparkline,
// and a verdict explaining whether "0 rows" is normal or pathological.
//
// Lives inside this file (not a standalone component) because shipping
// it as a separate module under src/pages/admin/monitor/ or
// src/components/ kept failing Vercel's build for opaque reasons —
// keeping all collector-detail UI co-located here sidesteps that.
// ─────────────────────────────────────────────────────────────────

const HealthCard = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr) auto;
  gap: 16px 24px;
  align-items: start;

  @media (max-width: 1100px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 700px)  { grid-template-columns: 1fr; }
`;

const HealthBlock = styled.div`
  min-width: 0;
  h5 {
    font-size: 11px;
    font-weight: 700;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 0 0 6px 0;
  }
  .value { font-size: 13px; color: #222; }
  .sub   { font-size: 11px; color: #888; margin-top: 2px; word-break: break-word; }
  code   { font-family: monospace; background: #f3f3f7; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
`;

const VerdictBox = styled.div<{ $tone: 'ok' | 'warn' | 'bad' | 'unknown' }>`
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  border-left: 4px solid ${(p) => {
    if (p.$tone === 'ok') return '#28a745';
    if (p.$tone === 'warn') return '#f0ad4e';
    if (p.$tone === 'bad') return '#dc3545';
    return '#adb5bd';
  }};
  background: ${(p) => {
    if (p.$tone === 'ok') return '#e9f6ec';
    if (p.$tone === 'warn') return '#fdf8ef';
    if (p.$tone === 'bad') return '#fdf3f4';
    return '#f3f3f7';
  }};
  color: #222;
  display: flex;
  align-items: center;
  gap: 10px;
  grid-column: 1 / -1;

  .icon { font-size: 18px; }
  .copy { display: flex; flex-direction: column; gap: 2px; }
  .copy strong { font-size: 13px; }
  .copy span  { font-size: 12px; color: #555; }
`;

const SparkBar = styled.div`
  display: flex;
  gap: 1px;
  margin-top: 4px;
  align-items: flex-end;
  height: 22px;
`;

const SparkSlot2 = styled.div<{ $color: string; $h: number }>`
  flex: 1;
  min-width: 4px;
  max-width: 12px;
  height: ${(p) => p.$h}%;
  min-height: 4px;
  background: ${(p) => p.$color};
  border-radius: 1px;
  transition: opacity 100ms ease;
  &:hover { opacity: 0.75; }
`;

const HealthStatGrid = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 10px;
  font-size: 12px;
  margin: 0;
  dt { color: #777; font-weight: 500; }
  dd { margin: 0; color: #222; font-weight: 600; }
`;

const GhBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  background: #24292e;
  color: #fff !important;
  border-radius: 4px;
  text-decoration: none !important;
  white-space: nowrap;
  &:hover { background: #1b1f23; }
`;

const RUN_COLOR: Record<CollectorRunStatRecent['status'], string> = {
  success: '#28a745',
  running: '#5bc0de',
  failed: '#dc3545',
  timeout: '#6c757d',
};

// Tiny inline cron→Spanish translator. Covers the patterns we actually
// use across xerenity-dm. Falls back to "(sin traducción)" otherwise.
// Avoids the cronstrue npm package because its /i18n submodule broke
// Vercel's build pipeline opaquely — works locally, fails on deploy.
const DOW_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const cronToEs = (cron: string | null): string | null => {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hr, , , dow] = parts;

  let when = '';
  if (hr === '*' && min === '*') when = 'cada minuto';
  else if (hr === '*' && /^\d+$/.test(min)) when = `al minuto ${min} de cada hora`;
  else if (/^\d+$/.test(hr) && /^\d+$/.test(min)) when = `a las ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  else if (/^[\d,]+$/.test(hr) && /^\d+$/.test(min)) {
    when = `a las ${hr.split(',').map((h) => `${h.padStart(2, '0')}:${min.padStart(2, '0')}`).join(', ')}`;
  }
  else if (/^\*\/(\d+)$/.test(hr) && min === '0') when = `cada ${hr.match(/^\*\/(\d+)$/)![1]}h`;

  let which = '';
  if (dow === '*') which = 'todos los días';
  else if (/^\d-\d$/.test(dow)) {
    const [a, b] = dow.split('-').map((d) => DOW_ES[parseInt(d, 10) % 7]);
    which = `de ${a} a ${b}`;
  }
  else if (/^[\d,]+$/.test(dow)) {
    const days = dow.split(',').map((d) => DOW_ES[parseInt(d, 10) % 7]);
    which = days.length === 1 ? `los ${days[0]}` : `los ${days.join(', ')}`;
  }

  if (!when || !which) return null;
  return `${which} ${when} (UTC)`;
};

const expectedFreqHours = (raw: string | null): number | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+)\s*(hour|hours|day|days|week|weeks|month|months)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('hour')) return n;
  if (unit.startsWith('day')) return n * 24;
  if (unit.startsWith('week')) return n * 24 * 7;
  if (unit.startsWith('month')) return n * 24 * 30;
  return null;
};

const computeLatestData = (series: CollectorTableSeries[]): string | null => {
  let latest: string | null = null;
  series.forEach((s) => {
    s.slices.forEach((sl) => {
      if ('error' in sl) return;
      const slice = sl as SliceBreakdown;
      if (slice.last_date && (!latest || slice.last_date > latest)) latest = slice.last_date;
    });
  });
  return latest;
};

const buildVerdict = (
  detail: CollectorFullDetail,
  latestData: string | null,
): { tone: 'ok' | 'warn' | 'bad' | 'unknown'; title: string; explain: string } => {
  const stats = detail.run_stats;
  const expectedH = expectedFreqHours(detail.definition.expected_frequency);

  if (!stats || stats.total === 0) {
    return { tone: 'unknown', title: 'Sin runs registrados', explain: 'Este collector aún no tiene runs en xerenity.collector_runs.' };
  }

  const lastFailed = stats.recent[0]?.status === 'failed' || stats.recent[0]?.status === 'timeout';
  const ageH = latestData ? (Date.now() - new Date(latestData).getTime()) / 3.6e6 : null;

  if (lastFailed) {
    return { tone: 'bad', title: 'Último run falló', explain: `El último run terminó en ${stats.recent[0].status} ${formatRelative(stats.recent[0].started_at)}. Revisar traceback en la pestaña Estado actual.` };
  }
  if (expectedH !== null && ageH !== null && ageH > expectedH * 2) {
    return { tone: 'bad', title: `Datos atrasados (${ageH.toFixed(0)}h)`, explain: `Cadencia esperada ${expectedH}h. Última fila ${formatRelative(latestData)}. Más del doble del rango.` };
  }
  if (expectedH !== null && ageH !== null && ageH > expectedH * 1.25) {
    return { tone: 'warn', title: `Datos un poco atrasados (${ageH.toFixed(0)}h)`, explain: `Cadencia esperada ${expectedH}h. Última fila ${formatRelative(latestData)}.` };
  }
  if ((stats.empty_rate_pct ?? 0) >= 50) {
    return { tone: 'ok', title: 'Patrón "muchos runs vacíos por diseño"', explain: `${stats.empty_rate_pct}% de los runs exitosos no insertaron filas. Lo común cuando la fuente publica menos seguido que el cron. La data fluye (última fila ${formatRelative(latestData)}).` };
  }
  if (stats.last_run_at && stats.last_data_run_at) {
    return { tone: 'ok', title: 'Sano', explain: `Última fila ${formatRelative(latestData)} · último run con data ${formatRelative(stats.last_data_run_at)}.` };
  }
  return { tone: 'unknown', title: 'No se puede evaluar', explain: 'Información insuficiente — revisa runs y datos manualmente.' };
};

const verdictIcon = (tone: 'ok' | 'warn' | 'bad' | 'unknown') => {
  if (tone === 'ok') return faCircleCheck;
  if (tone === 'warn') return faCircleExclamation;
  if (tone === 'bad') return faCircleXmark;
  return faCircleExclamation;
};

const verdictIconColor = (tone: 'ok' | 'warn' | 'bad' | 'unknown') => {
  if (tone === 'ok') return '#28a745';
  if (tone === 'warn') return '#f0ad4e';
  if (tone === 'bad') return '#dc3545';
  return '#6c757d';
};

const SaludSection: React.FC<{ detail: CollectorFullDetail }> = ({ detail }) => {
  const def = detail.definition;
  const stats = detail.run_stats;
  const latestData = useMemo(() => computeLatestData(detail.series ?? []), [detail.series]);
  const cronHuman = cronToEs(def.schedule_cron);
  const verdict = buildVerdict(detail, latestData);

  const ghHref = (() => {
    if (!def.repo) return null;
    if (def.workflow_file) return `https://github.com/avelezX/${def.repo}/blob/main/${def.workflow_file}`;
    return `https://github.com/avelezX/${def.repo}`;
  })();

  return (
    <HealthCard>
      <HealthBlock>
        <h5>Cron</h5>
        {def.schedule_cron ? (
          <>
            <div className="value"><code>{def.schedule_cron}</code></div>
            <div className="sub">{cronHuman ?? '(sin traducción para este patrón)'}</div>
            <div className="sub" style={{ marginTop: 6 }}>
              <strong>Cadencia esperada:</strong>{' '}
              {def.expected_frequency ? <code>{def.expected_frequency}</code> : <em>—</em>}
            </div>
          </>
        ) : (
          <div className="value"><em style={{ color: '#bbb' }}>sin cron</em></div>
        )}
      </HealthBlock>

      <HealthBlock>
        <h5>Frescura</h5>
        <HealthStatGrid>
          <dt>Última fila</dt>
          <dd>{latestData ? formatRelative(latestData) : <em style={{ color: '#bbb' }}>—</em>}</dd>
          <dt>Último run</dt>
          <dd>{stats?.last_run_at ? formatRelative(stats.last_run_at) : <em style={{ color: '#bbb' }}>—</em>}</dd>
          <dt>Último con data</dt>
          <dd>{stats?.last_data_run_at ? formatRelative(stats.last_data_run_at) : <em style={{ color: '#bbb' }}>—</em>}</dd>
        </HealthStatGrid>
      </HealthBlock>

      <HealthBlock>
        <h5>Últimos {stats?.total ?? 0} runs</h5>
        {stats && stats.total > 0 ? (
          <>
            <HealthStatGrid>
              <dt>OK</dt>
              <dd style={{ color: '#28a745' }}>
                {stats.success}{' '}
                <span style={{ color: '#888', fontWeight: 400 }}>
                  ({stats.with_data} con data, {stats.empty} vacíos)
                </span>
              </dd>
              <dt>Fallidos</dt>
              <dd style={{ color: stats.failed + stats.timeout > 0 ? '#dc3545' : '#999' }}>
                {stats.failed + stats.timeout}
                {stats.timeout > 0 && (
                  <span style={{ color: '#888', fontWeight: 400 }}> ({stats.timeout} timeout)</span>
                )}
              </dd>
              {stats.empty_rate_pct != null && (
                <>
                  <dt>% vacío</dt>
                  <dd>{stats.empty_rate_pct}%</dd>
                </>
              )}
              {stats.median_duration_s != null && (
                <>
                  <dt>Duración mediana</dt>
                  <dd>{stats.median_duration_s.toFixed(1)}s</dd>
                </>
              )}
            </HealthStatGrid>
            <SparkBar title="Status de los últimos 30 runs (más reciente a la derecha)">
              {[...stats.recent].reverse().map((r) => {
                const h = r.rows_inserted && r.rows_inserted > 0 ? 100 : 50;
                return (
                  <SparkSlot2
                    key={r.started_at}
                    $color={RUN_COLOR[r.status]}
                    $h={h}
                    title={`${r.status} · ${formatRelative(r.started_at)} · ${r.rows_inserted ?? 0} filas`}
                  />
                );
              })}
            </SparkBar>
          </>
        ) : (
          <div className="value"><em style={{ color: '#bbb' }}>sin runs</em></div>
        )}
      </HealthBlock>

      <HealthBlock style={{ textAlign: 'right' }}>
        <h5>Workflow</h5>
        {ghHref ? (
          <GhBtn href={ghHref} target="_blank" rel="noreferrer">
            Editar YAML
          </GhBtn>
        ) : (
          <em style={{ color: '#bbb', fontSize: 12 }}>—</em>
        )}
        <div className="sub" style={{ marginTop: 6 }}>
          <Badge bg={def.enabled ? 'success' : 'secondary'}>
            {def.enabled ? 'enabled' : 'DISABLED'}
          </Badge>{' '}
          <Badge bg="dark">{def.severity}</Badge>
        </div>
      </HealthBlock>

      <VerdictBox $tone={verdict.tone}>
        <Icon
          icon={verdictIcon(verdict.tone)}
          className="icon"
          style={{ color: verdictIconColor(verdict.tone) }}
        />
        <div className="copy">
          <strong>{verdict.title}</strong>
          <span>{verdict.explain}</span>
        </div>
      </VerdictBox>
    </HealthCard>
  );
};


const CatalogTab: React.FC<{ collectorName: string }> = ({ collectorName }) => {
  const { detail, loading, error, load } = useAppStore((s) => ({
    detail: s.catalogDetail[collectorName],
    loading: !!s.catalogDetailLoading[collectorName],
    error: s.catalogDetailError,
    load: s.loadCollectorDetail,
  }));

  useEffect(() => {
    if (!detail) load(collectorName);
  }, [collectorName, detail, load]);

  if (error) {
    return (
      <Section>
        <div style={{ color: '#dc3545' }}>Error cargando catálogo: {error}</div>
      </Section>
    );
  }

  if (loading || !detail) {
    return (
      <Section>
        <Spinner animation="border" size="sm" /> Cargando catálogo…
      </Section>
    );
  }

  return (
    <div>
      <SaludSection detail={detail} />
      <OrigenSection collectorName={collectorName} />
      <SeriesSection
        series={detail.series}
        collectorName={collectorName}
        dictionary={detail.dictionary ?? null}
      />
      <ConsumidoresSection consumers={detail.consumers} />
    </div>
  );
};

export default CatalogTab;
