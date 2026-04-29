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
  SliceBreakdown,
  ReviewStatus,
  HealthStatus,
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

const Notes = styled.div`
  font-size: 13px;
  color: #444;
  white-space: pre-wrap;
  background: #fafaff;
  border: 1px dashed #d8d8e6;
  border-radius: 4px;
  padding: 10px 12px;
  min-height: 38px;
  &.empty { color: #aaa; font-style: italic; }
`;

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

const SeriesSection: React.FC<{
  series: CollectorTableSeries[];
  collectorName: string;
}> = ({ series, collectorName }) => {
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
      <OrigenSection collectorName={collectorName} />
      <SeriesSection series={detail.series} collectorName={collectorName} />
      <ConsumidoresSection consumers={detail.consumers} />
    </div>
  );
};

export default CatalogTab;
