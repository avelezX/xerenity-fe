'use client';

import React, { useEffect, useMemo } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Button as BsButton } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faBellSlash,
  faCheck,
  faEye,
  faBook,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import type { Severity } from 'src/types/monitor';
import MonitorTable from './_MonitorTable';

const PageWrap = styled.div`
  padding: 16px 24px;
`;

// Canonical link to the operations playbook. Markdown is source of truth in
// xerenity-dm, GitHub renders it nicely (TOC, code highlight, edit button).
const PLAYBOOK_URL =
  'https://github.com/avelezX/xerenity-dm/blob/main/docs/COLLECTORS_PLAYBOOK.md';

const PlaybookLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #302b63;
  background: #f3f3f7;
  border: 1px solid #d8d8e6;
  padding: 4px 10px;
  border-radius: 4px;
  text-decoration: none !important;
  margin-left: 12px;
  vertical-align: middle;

  &:hover {
    background: #e9e9f0;
    color: #1f1b3e;
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 6px;
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

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

const MonitorPage = () => {
  const {
    collectorOverviewEnriched,
    activeAlerts,
    loadCollectorOverviewEnriched,
    loadActiveAlerts,
    acknowledgeAlert,
    silenceAlert,
    resolveAlert,
  } = useAppStore((s) => ({
    collectorOverviewEnriched: s.collectorOverviewEnriched,
    activeAlerts: s.activeAlerts,
    loadCollectorOverviewEnriched: s.loadCollectorOverviewEnriched,
    loadActiveAlerts: s.loadActiveAlerts,
    acknowledgeAlert: s.acknowledgeAlert,
    silenceAlert: s.silenceAlert,
    resolveAlert: s.resolveAlert,
  }));

  useEffect(() => {
    loadCollectorOverviewEnriched();
    loadActiveAlerts();
    const interval = setInterval(() => {
      loadCollectorOverviewEnriched();
      loadActiveAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadCollectorOverviewEnriched, loadActiveAlerts]);

  const counts = useMemo(() => {
    const total = collectorOverviewEnriched.length;
    const critical = collectorOverviewEnriched.filter((c) => c.has_critical_alert).length;
    const warning = collectorOverviewEnriched.filter((c) => c.has_warning_alert && !c.has_critical_alert).length;
    const ok = collectorOverviewEnriched.filter(
      (c) => !c.has_critical_alert && !c.has_warning_alert && c.last_run?.status === 'success',
    ).length;
    return { total, critical, warning, ok };
  }, [collectorOverviewEnriched]);

  const alertCounts = useMemo(() => {
    const critical = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warning = activeAlerts.filter((a) => a.severity === 'warning').length;
    const tableStale = activeAlerts.filter((a) => a.source === 'table_stale').length;
    return { critical, warning, tableStale, total: activeAlerts.length };
  }, [activeAlerts]);

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
          <TitleRow>
            <PageTitle>Monitor de Collectors</PageTitle>
            <PlaybookLink
              href={PLAYBOOK_URL}
              target="_blank"
              rel="noreferrer"
              title="Manual operacional de collectors — markdown en xerenity-dm. Edición vía PR."
            >
              <Icon icon={faBook} /> Playbook
              <Icon icon={faArrowUpRightFromSquare} style={{ fontSize: 9 }} />
            </PlaybookLink>
          </TitleRow>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
            <strong>Collectors:</strong> {counts.ok}/{counts.total} OK · {counts.warning} en warning · {counts.critical} en critical
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            <strong>Alertas activas:</strong>{' '}
            {alertCounts.total === 0 ? (
              <span style={{ color: '#28a745' }}>0 — todo tranquilo</span>
            ) : (
              <>
                <span style={{ color: alertCounts.critical > 0 ? '#dc3545' : '#666', fontWeight: alertCounts.critical > 0 ? 600 : 'normal' }}>
                  {alertCounts.critical} critical
                </span>
                {' · '}
                <span style={{ color: alertCounts.warning > 0 ? '#f0ad4e' : '#666', fontWeight: alertCounts.warning > 0 ? 600 : 'normal' }}>
                  {alertCounts.warning} warning
                </span>
                {alertCounts.tableStale > 0 && (
                  <span style={{ color: '#888', marginLeft: 6 }}>
                    ({alertCounts.tableStale} de tablas stale — ver panel derecho)
                  </span>
                )}
              </>
            )}
          </div>

          <Container fluid>
            <Row>
              <Col xl={9} lg={8}>
                <MonitorTable rows={collectorOverviewEnriched} />
              </Col>
              <Col xl={3} lg={4}>
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
                            title="Marca la alerta como vista. La alerta sigue ABIERTA hasta que se resuelva el problema o se cierre manualmente."
                            onClick={() => handleAction(() => acknowledgeAlert(alert.id), 'ACK')}
                          >
                            <Icon icon={faEye} /> ACK
                          </BsButton>
                        )}
                        <BsButton
                          size="sm"
                          variant="outline-secondary"
                          title="Silencia la alerta por 1 hora. Si el problema persiste tras ese plazo, vuelve a aparecer en el panel y a postear a Teams."
                          onClick={() => handleAction(() => silenceAlert(alert.id, '1 hour'), 'Silenciada 1h')}
                        >
                          <Icon icon={faBellSlash} /> 1h
                        </BsButton>
                        <BsButton
                          size="sm"
                          variant="outline-secondary"
                          title="Silencia la alerta por 24 horas. Útil mientras se trabaja en un fix; reaparece al día siguiente si el problema sigue."
                          onClick={() => handleAction(() => silenceAlert(alert.id, '1 day'), 'Silenciada 24h')}
                        >
                          <Icon icon={faBellSlash} /> 24h
                        </BsButton>
                        <BsButton
                          size="sm"
                          variant="outline-success"
                          title="Cierra la alerta y postea card RESOLVED a Teams. NO arregla la causa: si el próximo health check detecta el mismo problema, se vuelve a abrir."
                          onClick={() => handleAction(() => resolveAlert(alert.id), 'Cerrada')}
                        >
                          <Icon icon={faCheck} /> Cerrar
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
