'use client';

// Catálogo — table detail page (Phase 2).
// Shows: meta + freshness + columns + slice dictionary + lineage
// (collectors writing, consumers reading). Public to authenticated.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styled from 'styled-components';
import { Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faStar,
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';
import { CoreLayout } from '@layout';
import PageTitle from '@components/PageTitle';
import DictionaryBlock from 'src/components/dataCatalog/DictionaryBlock';
import {
  describeTable,
  getTableLineage,
  getTableFreshness,
} from 'src/models/dataCatalog';
import type {
  TableDescription,
  TableLineage,
  TableFreshness,
} from 'src/types/catalog';

// ─────────────────────────────────────────────────────────────────
// Styled
// ─────────────────────────────────────────────────────────────────

const PageWrap = styled.div`
  padding: 16px 24px;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #302b63;
  font-size: 13px;
  margin-bottom: 12px;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

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
`;

const MetaGrid = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  font-size: 13px;
  margin: 0;
  dt { font-weight: 600; color: #555; }
  dd { margin: 0; word-break: break-word; }
  code { font-family: monospace; background: #f3f3f7; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
`;

type Tone = 'ok' | 'warn' | 'bad';

const TONE_BORDER: Record<Tone, string> = {
  ok: '#28a745',
  warn: '#f0ad4e',
  bad: '#dc3545',
};

const TONE_BG: Record<Tone, string> = {
  ok: '#e9f6ec',
  warn: '#fdf8ef',
  bad: '#fdf3f4',
};

const TONE_ICON = (tone: Tone) => {
  if (tone === 'ok') return faCircleCheck;
  if (tone === 'warn') return faCircleExclamation;
  return faCircleXmark;
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

const FreshCard = styled.div<{ $tone: Tone }>`
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  border-left: 4px solid ${(p) => TONE_BORDER[p.$tone]};
  background: ${(p) => TONE_BG[p.$tone]};
  margin-bottom: 12px;
`;

const SubTable = styled.table`
  width: 100%;
  margin-bottom: 0;
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
  code { font-family: monospace; background: #f3f3f7; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
`;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'sin datos';
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / 3.6e6;
  if (hours < 1) return 'hace <1h';
  if (hours < 48) return `hace ${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `hace ${Math.round(days)}d`;
  if (days < 365) return `hace ${Math.round(days / 30)} meses`;
  return `hace ${(days / 365).toFixed(1)} años`;
};

const freshnessTone = (ageHours: number | null): 'ok' | 'warn' | 'bad' => {
  if (ageHours == null) return 'bad';
  if (ageHours <= 48) return 'ok';
  if (ageHours <= 168) return 'warn';   // 7 días
  return 'bad';
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const DataCatalogTableDetail = () => {
  const router = useRouter();
  const tableParam = router.query.table;
  const tableName = Array.isArray(tableParam) ? tableParam[0] : tableParam;

  const [description, setDescription] = useState<TableDescription | null>(null);
  const [lineage, setLineage] = useState<TableLineage | null>(null);
  const [freshness, setFreshness] = useState<TableFreshness | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableName) return;
    setLoading(true);
    Promise.all([
      describeTable(tableName),
      getTableLineage(tableName),
      getTableFreshness(tableName),
    ]).then(([d, l, f]) => {
      if (d.error) setError(d.error);
      if (d.data) setDescription(d.data);
      if (l.data) setLineage(l.data);
      if (f.data) setFreshness(f.data);
      setLoading(false);
    });
  }, [tableName]);

  if (!tableName) {
    return (
      <CoreLayout>
        <PageWrap><em>Cargando…</em></PageWrap>
      </CoreLayout>
    );
  }

  if (loading) {
    return (
      <CoreLayout>
        <PageWrap>
          <BackLink href="/data-catalog">
            <Icon icon={faArrowLeft} /> Volver al catálogo
          </BackLink>
          <PageTitle>{tableName}</PageTitle>
          <em>Cargando información de la tabla…</em>
        </PageWrap>
      </CoreLayout>
    );
  }

  if (error || !description) {
    return (
      <CoreLayout>
        <PageWrap>
          <BackLink href="/data-catalog">
            <Icon icon={faArrowLeft} /> Volver al catálogo
          </BackLink>
          <PageTitle>{tableName}</PageTitle>
          <div style={{ color: '#dc3545' }}>
            {error ?? 'No se pudo cargar la tabla.'}
          </div>
        </PageWrap>
      </CoreLayout>
    );
  }

  const { meta, columns, slices } = description;
  const overall = freshness?.overall;
  const perSlice = freshness?.per_slice;
  const ageHours = overall?.age_hours ?? null;
  const tone = freshnessTone(ageHours);

  return (
    <CoreLayout>
      <PageWrap>
        <BackLink href="/data-catalog">
          <Icon icon={faArrowLeft} /> Volver al catálogo
        </BackLink>

        <PageTitle>
          {meta.is_critical && (
            <Icon icon={faStar} style={{ color: '#dc3545', marginRight: 8 }} />
          )}
          {meta.table_name}
        </PageTitle>

        {meta.label && (
          <div style={{ fontSize: 14, color: '#555', marginBottom: 16 }}>{meta.label}</div>
        )}

        {/* ── Frescura ─── */}
        {overall && !overall.error && (
          <FreshCard $tone={tone}>
            <Icon icon={TONE_ICON(tone)} style={{ marginRight: 8 }} />
            <strong>{overall.row_count.toLocaleString()} filas</strong> · última observación{' '}
            <strong>{formatRelative(overall.last_date)}</strong>
            {overall.first_date && (
              <> · histórico desde <strong>{overall.first_date}</strong></>
            )}
          </FreshCard>
        )}

        {/* ── Meta ─── */}
        <Section>
          <SectionHeader>Información de la tabla</SectionHeader>
          <MetaGrid>
            <dt>Schema / Tabla</dt>
            <dd><code>xerenity.{meta.table_name}</code></dd>
            {meta.category && (
              <>
                <dt>Categoría</dt>
                <dd><Badge bg="info">{meta.category}</Badge></dd>
              </>
            )}
            {meta.country && (
              <>
                <dt>País / región</dt>
                <dd><Badge bg="secondary">{meta.country}</Badge></dd>
              </>
            )}
            <dt>Crítica</dt>
            <dd>{meta.is_critical ? '⭐ sí — alimenta cálculos clave del libro de derivados' : 'no'}</dd>
            <dt>Columna fecha</dt>
            <dd>{meta.date_column ? <code>{meta.date_column}</code> : <em>—</em>}</dd>
            <dt>Columna slice</dt>
            <dd>{meta.slice_column ? <code>{meta.slice_column}</code> : <em>—</em>}</dd>
            {meta.description && (
              <>
                <dt>Descripción</dt>
                <dd style={{ fontSize: 12, color: '#444' }}>{meta.description}</dd>
              </>
            )}
          </MetaGrid>

          <DictionaryBlock columns={columns} slices={slices} />
        </Section>

        {/* ── Per-slice freshness ─── */}
        {Array.isArray(perSlice) && perSlice.length > 0 && (
          <Section>
            <SectionHeader>
              Frescura por {meta.slice_column ? <code>{meta.slice_column}</code> : 'slice'}
            </SectionHeader>
            <SubTable>
              <thead>
                <tr>
                  <th>Slice</th>
                  <th>Filas</th>
                  <th>Primera fecha</th>
                  <th>Última fecha</th>
                </tr>
              </thead>
              <tbody>
                {perSlice.slice(0, 50).map((p) => (
                  <tr key={p.slice_value}>
                    <td><code>{p.slice_value}</code></td>
                    <td>{p.row_count.toLocaleString()}</td>
                    <td>{p.first_date ?? '—'}</td>
                    <td>{p.last_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </SubTable>
            {perSlice.length > 50 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                Mostrando primeras 50 de {perSlice.length} slices.
              </div>
            )}
          </Section>
        )}

        {/* ── Lineage: who writes ─── */}
        {lineage && lineage.writers.length > 0 && (
          <Section>
            <SectionHeader>Quién la pobla (collectors)</SectionHeader>
            <SubTable>
              <thead>
                <tr>
                  <th>Collector</th>
                  <th>Source</th>
                  <th>Cron</th>
                  <th>Cadencia esperada</th>
                  <th>Severity</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {lineage.writers.map((w) => (
                  <tr key={w.name}>
                    <td><code>{w.name}</code></td>
                    <td>{w.source_name ?? <em>—</em>}</td>
                    <td>{w.schedule_cron ? <code>{w.schedule_cron}</code> : <em>—</em>}</td>
                    <td>{w.expected_frequency ?? <em>—</em>}</td>
                    <td>
                      <Badge
                        bg={SEVERITY_BG[w.severity] ?? 'secondary'}
                        style={{ color: w.severity === 'warning' ? '#000' : '#fff' }}
                      >
                        {w.severity}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={w.enabled ? 'success' : 'secondary'}>
                        {w.enabled ? 'sí' : 'NO'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SubTable>
            {lineage.writers.filter((w) => w.description).length > 0 && (
              <div style={{ marginTop: 12 }}>
                {lineage.writers
                  .filter((w) => w.description)
                  .map((w) => (
                    <div key={w.name} style={{ marginBottom: 8, fontSize: 12, color: '#444' }}>
                      <strong style={{ color: '#302b63' }}>{w.name}</strong>: {w.description}
                    </div>
                  ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Lineage: who reads ─── */}
        {lineage && lineage.readers.length > 0 && (
          <Section>
            <SectionHeader>Quién la consume (consumers)</SectionHeader>
            <SubTable>
              <thead>
                <tr>
                  <th>Consumer</th>
                  <th>Tipo</th>
                  <th>Label</th>
                  <th>Path</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {lineage.readers.map((r) => (
                  <tr key={r.name}>
                    <td><code>{r.name}</code></td>
                    <td><Badge bg="secondary">{r.consumer_type}</Badge></td>
                    <td>{r.label}</td>
                    <td>{r.path ? <code>{r.path}</code> : <em>—</em>}</td>
                    <td><Badge bg={r.enabled ? 'success' : 'secondary'}>{r.enabled ? 'sí' : 'NO'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </SubTable>
          </Section>
        )}

        {lineage && lineage.writers.length === 0 && lineage.readers.length === 0 && (
          <Section>
            <SectionHeader>Lineage</SectionHeader>
            <div style={{ color: '#888', fontSize: 13, fontStyle: 'italic' }}>
              Ningún collector escribe a esta tabla y ningún consumer la lee según el catálogo actual.
              Si esto es incorrecto, registrar el collector en xerenity.collector_definitions o el
              consumer en xerenity.data_consumers (super_admin only).
            </div>
          </Section>
        )}
      </PageWrap>
    </CoreLayout>
  );
};

export default DataCatalogTableDetail;
