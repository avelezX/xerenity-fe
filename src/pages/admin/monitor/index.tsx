'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Badge, Button as BsButton } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faCircleMinus,
  faClock,
  faArrowUpRightFromSquare,
  faBellSlash,
  faCheck,
  faEye,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import type { CollectorOverview, Severity, RunStatus } from 'src/types/monitor';

const PageWrap = styled.div`
  padding: 16px 24px;
`;

const StatusDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  background: ${(p) => p.$color};
  vertical-align: middle;
`;

const TableWrap = styled.div`
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  table { width: 100%; margin-bottom: 0; border-collapse: collapse; }
  thead th {
    background: #302b63;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 10px 12px;
    text-align: left;
  }
  tbody td {
    font-size: 13px;
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
  }
  tbody tr:hover { background: rgba(48, 43, 99, 0.05); }
  a { color: #302b63; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
`;

const AlertsPanel = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  h4 { font-size: 14px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #302b63; }
`;

const SEV_COLORS: Record<Severity, string> = {
  critical: '#dc3545',
  warning:  '#f0ad4e',
  info:     '#5bc0de',
};
const SEV_BG: Record<Severity, string> = {
  critical: '#fdf3f4',
  warning:  '#fdf8ef',
  info:     '#f2f9fc',
};

const AlertCard = styled.div<{ $severity: Severity }>`
  border-left: 4px solid ${(p) => SEV_COLORS[p.$severity]};
  background: ${(p) => SEV_BG[p.$severity]};
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 4px;

  .title { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  .body  { font-size: 12px; color: #555; margin-bottom: 8px; word-break: break-word; }
  .meta  { font-size: 11px; color: #888; margin-bottom: 8px; }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .actions button { font-size: 11px; padding: 4px 8px; }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 32px 8px;
`;

const statusColor = (row: CollectorOverview): string => {
  if (row.has_critical_alert) return '#dc3545';
  if (row.has_warning_alert) return '#f0ad4e';
  if (!row.last_run) return '#b0b0b0';
  if (row.last_run.status === 'success') return '#28a745';
  if (row.last_run.status === 'running') return '#5bc0de';
  return '#dc3545';
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

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours}h`;
  const days = Math.round(hours / 24);
  return `hace ${days}d`;
};

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.floor(seconds - mins * 60);
  return `${mins}m ${rem}s`;
};

const MonitorPage = () => {
  const {
    collectorOverview,
    activeAlerts,
    loadCollectorOverview,
    loadActiveAlerts,
    acknowledgeAlert,
    silenceAlert,
    resolveAlert,
  } = useAppStore((s) => ({
    collectorOverview: s.collectorOverview,
    activeAlerts: s.activeAlerts,
    loadCollectorOverview: s.loadCollectorOverview,
    loadActiveAlerts: s.loadActiveAlerts,
    acknowledgeAlert: s.acknowledgeAlert,
    silenceAlert: s.silenceAlert,
    resolveAlert: s.resolveAlert,
  }));

  useEffect(() => {
    loadCollectorOverview();
    loadActiveAlerts();
    const interval = setInterval(() => {
      loadCollectorOverview();
      loadActiveAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadCollectorOverview, loadActiveAlerts]);

  const counts = useMemo(() => {
    const total = collectorOverview.length;
    const critical = collectorOverview.filter((c) => c.has_critical_alert).length;
    const warning  = collectorOverview.filter((c) => c.has_warning_alert && !c.has_critical_alert).length;
    const ok       = collectorOverview.filter((c) => !c.has_critical_alert && !c.has_warning_alert && c.last_run?.status === 'success').length;
    return { total, critical, warning, ok };
  }, [collectorOverview]);

  const handleAction = async (
    action: () => Promise<{ success: boolean; error: string | undefined }>,
    successMsg: string,
  ) => {
    const res = await action();
    if (res.success) toast.success(successMsg);
    else toast.error(res.error ?? 'Error');
  };

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
          <PageTitle>Monitor de Collectors</PageTitle>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {counts.ok}/{counts.total} OK · {counts.warning} en warning · {counts.critical} en critical
          </div>
          <Container fluid>
            <Row>
              <Col md={8}>
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 24 }} aria-label="status indicator" />
                        <th>Collector</th>
                        <th>Severity</th>
                        <th>Último run</th>
                        <th>Duración</th>
                        <th>Alertas</th>
                        <th>Tablas</th>
                        <th aria-label="external links" />
                      </tr>
                    </thead>
                    <tbody>
                      {collectorOverview.map((row) => (
                        <tr key={row.name}>
                          <td><StatusDot $color={statusColor(row)} /></td>
                          <td>
                            <Link href={`/admin/monitor/${encodeURIComponent(row.name)}`}>
                              {row.name}
                            </Link>
                          </td>
                          <td>
                            <Badge
                              style={{
                                background: SEV_COLORS[row.severity_default],
                                fontWeight: 500,
                              }}
                            >
                              {row.severity_default}
                            </Badge>
                          </td>
                          <td>
                            {row.last_run ? (
                              <>
                                {statusBadge(row.last_run.status)}
                                <span style={{ marginLeft: 8, color: '#888' }}>
                                  {formatRelative(row.last_run.started_at)}
                                </span>
                              </>
                            ) : (
                              <span style={{ color: '#999' }}>
                                <Icon icon={faCircleMinus} style={{ marginRight: 4 }} />
                                nunca
                              </span>
                            )}
                          </td>
                          <td>{formatDuration(row.last_run?.duration_s ?? null)}</td>
                          <td>
                            {row.open_alerts > 0 ? (
                              <Badge bg="danger">{row.open_alerts}</Badge>
                            ) : (
                              <span style={{ color: '#bbb' }}>0</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: '#666' }}>
                            {row.target_tables.length > 0
                              ? row.target_tables.join(', ')
                              : <em style={{ color: '#bbb' }}>—</em>}
                          </td>
                          <td>
                            {row.last_run?.gh_run_url && (
                              <a
                                href={row.last_run.gh_run_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12 }}
                              >
                                GH <Icon icon={faArrowUpRightFromSquare} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                      {collectorOverview.length === 0 && (
                        <tr>
                          <td colSpan={8}>
                            <EmptyState>Sin collectors en el catálogo.</EmptyState>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableWrap>
              </Col>
              <Col md={4}>
                <AlertsPanel>
                  <h4>Alertas activas ({activeAlerts.length})</h4>
                  {activeAlerts.length === 0 && (
                    <EmptyState>
                      <Icon icon={faCircleCheck} style={{ color: '#28a745', fontSize: 24, marginBottom: 8 }} /><br />
                      Todo tranquilo.
                    </EmptyState>
                  )}
                  {activeAlerts.map((alert) => (
                    <AlertCard key={alert.id} $severity={alert.severity}>
                      <div className="title">{alert.title}</div>
                      {alert.body && <div className="body">{alert.body}</div>}
                      <div className="meta">
                        {alert.collector_name && <>collector: {alert.collector_name}<br /></>}
                        {alert.table_name && <>tabla: {alert.table_name}<br /></>}
                        {alert.occurrence_count > 1 && <>×{alert.occurrence_count} · </>}
                        primera vez {formatRelative(alert.first_seen_at)}
                      </div>
                      <div className="actions">
                        {!alert.acknowledged_at && (
                          <BsButton
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => handleAction(() => acknowledgeAlert(alert.id), 'ACK')}
                          >
                            <Icon icon={faEye} /> ACK
                          </BsButton>
                        )}
                        <BsButton
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => handleAction(() => silenceAlert(alert.id, '1 hour'), 'Silenciada 1h')}
                        >
                          <Icon icon={faBellSlash} /> 1h
                        </BsButton>
                        <BsButton
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => handleAction(() => silenceAlert(alert.id, '1 day'), 'Silenciada 24h')}
                        >
                          <Icon icon={faBellSlash} /> 24h
                        </BsButton>
                        <BsButton
                          size="sm"
                          variant="outline-success"
                          onClick={() => handleAction(() => resolveAlert(alert.id), 'Resuelta')}
                        >
                          <Icon icon={faCheck} /> Resolver
                        </BsButton>
                      </div>
                    </AlertCard>
                  ))}
                </AlertsPanel>
              </Col>
            </Row>
          </Container>
        </PageWrap>
      </RoleGuard>
    </CoreLayout>
  );
};

export default MonitorPage;
