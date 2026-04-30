'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleXmark,
  faClock,
  faCircleExclamation,
  faArrowUpRightFromSquare,
  faArrowLeft,
  faChevronDown,
  faChevronRight,
  faGauge,
  faBookOpen,
} from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import type { CollectorRun, CollectorOverview, RunStatus, Severity } from 'src/types/monitor';
import { getCollectorDefinition } from 'src/models/monitor';
import CatalogTab from './_CatalogTab';

const SEV_BADGE: Record<Severity, string> = {
  critical: '#dc3545',
  warning:  '#f0ad4e',
  info:     '#5bc0de',
};

const PageWrap = styled.div`
  padding: 16px 24px;
`;

const InfoCard = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;

  h4 { font-size: 14px; text-transform: uppercase; color: #302b63; margin: 0 0 12px 0; font-weight: 700; letter-spacing: 0.5px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 13px; margin: 0; }
  dt { font-weight: 600; color: #666; }
  dd { margin: 0; }
  code { font-family: monospace; background: #f3f3f7; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
`;

const TimelineCard = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  h4 { font-size: 14px; text-transform: uppercase; color: #302b63; margin: 0; padding: 16px; font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid #eee; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #fafaff; font-size: 11px; text-transform: uppercase; color: #555; font-weight: 600; padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  tbody td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f5f5f5; vertical-align: top; }
  tbody tr.failed { background: #fdf3f4; }
  tbody tr.failed:hover { background: #fae7ea; }
  tbody tr:hover { background: rgba(48, 43, 99, 0.03); }
  .expander { cursor: pointer; user-select: none; }
  .traceback { background: #222; color: #eee; font-family: monospace; font-size: 11px; padding: 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow: auto; margin-top: 6px; }
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

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 2px solid #e5e5ec;
  margin-bottom: 16px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? '#fff' : 'transparent')};
  border: none;
  border-bottom: 3px solid ${(p) => (p.$active ? '#302b63' : 'transparent')};
  color: ${(p) => (p.$active ? '#302b63' : '#777')};
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 18px;
  margin-bottom: -2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;

  &:hover {
    color: #302b63;
    background: rgba(48, 43, 99, 0.04);
  }
`;

// Tiny inline cron→Spanish translator. Covers the patterns we use in
// xerenity-dm. Returns null for shapes it doesn't understand so the UI
// can fall back gracefully. Inlined (rather than depending on cronstrue)
// because the cronstrue/i18n submodule breaks Vercel's build pipeline
// opaquely in this codebase.
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
  } else if (/^\*\/(\d+)$/.test(hr) && min === '0') {
    when = `cada ${hr.match(/^\*\/(\d+)$/)![1]}h`;
  }

  let which = '';
  if (dow === '*') which = 'todos los días';
  else if (/^\d-\d$/.test(dow)) {
    const [a, b] = dow.split('-').map((d) => DOW_ES[parseInt(d, 10) % 7]);
    which = `de ${a} a ${b}`;
  } else if (/^[\d,]+$/.test(dow)) {
    const days = dow.split(',').map((d) => DOW_ES[parseInt(d, 10) % 7]);
    which = days.length === 1 ? `los ${days[0]}` : `los ${days.join(', ')}`;
  }

  if (!when || !which) return null;
  return `${which} ${when} (UTC)`;
};

const statusBadge = (status: RunStatus) => {
  const cfg: Record<RunStatus, { bg: string; icon: typeof faCircleCheck }> = {
    success: { bg: '#28a745', icon: faCircleCheck },
    running: { bg: '#5bc0de', icon: faClock },
    failed:  { bg: '#dc3545', icon: faCircleXmark },
    timeout: { bg: '#6c757d', icon: faCircleExclamation },
  };
  const { bg, icon } = cfg[status];
  return (
    <Badge style={{ background: bg, fontWeight: 500 }}>
      <Icon icon={icon} style={{ marginRight: 4 }} /> {status}
    </Badge>
  );
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.floor(seconds - mins * 60);
  return `${mins}m ${rem}s`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
};

const CollectorDetailPage = () => {
  const router = useRouter();
  const nameParam = router.query.name;
  const name = Array.isArray(nameParam) ? nameParam[0] : nameParam;

  const [definition, setDefinition] = useState<CollectorOverview | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'estado' | 'catalogo'>('estado');

  const {
    collectorRuns,
    loadCollectorRuns,
  } = useAppStore((s) => ({
    collectorRuns: s.collectorRuns,
    loadCollectorRuns: s.loadCollectorRuns,
  }));

  useEffect(() => {
    if (!name) return;
    loadCollectorRuns(name, 30);
    getCollectorDefinition(name).then((r) => setDefinition(r.data));
  }, [name, loadCollectorRuns]);

  const runs: CollectorRun[] = name ? collectorRuns[name] ?? [] : [];

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <CoreLayout>
      <RoleGuard
        requiredRole="super_admin"
        fallback={
          <PageWrap>
            <PageTitle>Monitor</PageTitle>
            <p>Requiere permisos de super admin.</p>
          </PageWrap>
        }
      >
        <PageWrap>
          <BackLink href="/admin/monitor">
            <Icon icon={faArrowLeft} /> Volver al overview
          </BackLink>
          <PageTitle>{name ?? 'Collector'}</PageTitle>

          <TabBar role="tablist" aria-label="Vistas del collector">
            <TabButton
              type="button"
              role="tab"
              aria-selected={activeTab === 'estado'}
              $active={activeTab === 'estado'}
              onClick={() => setActiveTab('estado')}
            >
              <Icon icon={faGauge} /> Estado actual
            </TabButton>
            <TabButton
              type="button"
              role="tab"
              aria-selected={activeTab === 'catalogo'}
              $active={activeTab === 'catalogo'}
              onClick={() => setActiveTab('catalogo')}
            >
              <Icon icon={faBookOpen} /> Catálogo
            </TabButton>
          </TabBar>

          {activeTab === 'estado' && (
            <Container fluid>
              <Row>
                <Col md={4}>
                  <InfoCard>
                    <h4>Catálogo</h4>
                    {definition ? (
                      <dl>
                        <dt>Severity</dt>
                        <dd><Badge style={{ background: SEV_BADGE[definition.severity_default] }}>{definition.severity_default}</Badge></dd>
                        <dt>Enabled</dt>
                        <dd>{definition.enabled ? 'Sí' : 'No'}</dd>
                        <dt>Cron</dt>
                        <dd>
                          {definition.schedule_cron ? (
                            <>
                              <code>{definition.schedule_cron}</code>
                              {cronToEs(definition.schedule_cron) && (
                                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                  ↳ {cronToEs(definition.schedule_cron)}
                                </div>
                              )}
                            </>
                          ) : (
                            <em>no-schedule</em>
                          )}
                        </dd>
                        <dt>Tablas</dt>
                        <dd>{definition.target_tables.length > 0 ? definition.target_tables.join(', ') : <em>—</em>}</dd>
                        <dt>Alertas</dt>
                        <dd>{definition.open_alerts}</dd>
                      </dl>
                    ) : (
                      <em style={{ color: '#888' }}>Cargando…</em>
                    )}
                  </InfoCard>
                </Col>
                <Col md={8}>
                  <TimelineCard>
                    <h4>Últimos runs ({runs.length})</h4>
                    <table>
                      <thead>
                        <tr>
                          <th aria-label="expand traceback" />
                          <th>Inicio</th>
                          <th>Status</th>
                          <th>Duración</th>
                          <th>Filas</th>
                          <th>Exit</th>
                          <th>Error</th>
                          <th aria-label="external link" />
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => {
                          const isExpanded = expanded[run.id] ?? false;
                          const hasTraceback = Boolean(run.error_traceback);
                          return (
                            <React.Fragment key={run.id}>
                              <tr className={run.status === 'failed' || run.status === 'timeout' ? 'failed' : ''}>
                                <td
                                  className={hasTraceback ? 'expander' : ''}
                                  onClick={hasTraceback ? () => toggle(run.id) : undefined}
                                >
                                  {hasTraceback && (
                                    <Icon icon={isExpanded ? faChevronDown : faChevronRight} />
                                  )}
                                </td>
                                <td>{formatDate(run.started_at)}</td>
                                <td>{statusBadge(run.status)}</td>
                                <td>{formatDuration(run.duration_seconds)}</td>
                                <td>{run.rows_inserted ?? '—'}</td>
                                <td>{run.exit_code ?? '—'}</td>
                                <td style={{ color: '#888', maxWidth: 280 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {run.error_message ?? ''}
                                  </div>
                                </td>
                                <td>
                                  {run.gh_run_url && (
                                    <a href={run.gh_run_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                                      GH <Icon icon={faArrowUpRightFromSquare} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && hasTraceback && (
                                <tr>
                                  <td colSpan={8}>
                                    <div className="traceback">{run.error_traceback}</div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {runs.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                              Sin runs registrados aún.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </TimelineCard>
                </Col>
              </Row>
            </Container>
          )}

          {activeTab === 'catalogo' && name && (
            <Container fluid>
              <CatalogTab collectorName={name} />
            </Container>
          )}
        </PageWrap>
      </RoleGuard>
    </CoreLayout>
  );
};

export default CollectorDetailPage;
