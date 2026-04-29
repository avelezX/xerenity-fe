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
  faRobot,
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

const formatRowsInserted = (rows: number | null | undefined) => {
  // null = the wrapper couldn't snapshot (older runs, RLS, etc.) — show — quietly.
  // 0 = the run completed cleanly but did NOT write anything; for a daily
  // collector this is suspicious enough that we want it to stand out
  // visually even if no empty_run alert has been raised yet.
  if (rows === null || rows === undefined) {
    return <span style={{ color: '#bbb' }} title="rows_inserted no fue capturado en este run">—</span>;
  }
  if (rows === 0) {
    return (
      <span
        style={{ color: '#b8860b', fontWeight: 600 }}
        title="0 filas — el run terminó OK pero no escribió nada"
      >
        0
      </span>
    );
  }
  return rows.toLocaleString();
};

type DiagnoseAlert = {
  source: string;
  collector_name: string | null;
  table_name: string | null;
  body: string | null;
  metadata?: Record<string, unknown> | null;
};

const buildRunFailedPrompt = (alert: DiagnoseAlert): string => {
  const md = (alert.metadata ?? {}) as Record<string, unknown>;
  const ghUrl = typeof md.gh_run_url === 'string' ? md.gh_run_url : null;
  const exitCode = md.exit_code != null ? String(md.exit_code) : 'desconocido';
  return [
    `Estoy debuggeando un fallo de ejecucion de un collector de Xerenity. Necesito tu ayuda para entender la causa raiz y proponer un fix.`,
    ``,
    `**Datos del fallo**`,
    `- Collector: \`${alert.collector_name ?? 'desconocido'}\``,
    `- Repo: \`xerenity-dm\``,
    `- Exit code: ${exitCode}`,
    ghUrl ? `- GitHub Actions run: ${ghUrl}` : null,
    ``,
    `**Mensaje de error / traceback**`,
    '```',
    alert.body ?? '(sin mensaje)',
    '```',
    ``,
    `**Que necesito que hagas:**`,
    `1. Encontra el repo_path del collector con \`query_database\`:`,
    '```sql',
    `SELECT repo_path, target_tables FROM xerenity.collector_definitions WHERE name = '${alert.collector_name}';`,
    '```',
    `2. Usa \`read_repo_file\` para leer el script entrypoint y los modulos referenciados en el traceback.`,
    `3. Identifica la linea exacta del bug.`,
    `4. Explica en español la causa raiz.`,
    `5. Sugerime un fix concreto: archivo, linea, codigo antes y despues.`,
    ``,
    `Nada de cambios todavia — solo diagnostico. Yo aplico el fix manualmente.`,
  ].filter(Boolean).join('\n');
};

const buildTableStalePrompt = (alert: DiagnoseAlert): string => {
  const tbl = alert.table_name ?? 'desconocida';
  return [
    `Una tabla de Xerenity esta stale (sin datos recientes). Ayudame a entender por que y proponer un fix.`,
    ``,
    `**Tabla afectada:** \`${tbl}\``,
    `**Detalle:** ${alert.body ?? '(sin detalle)'}`,
    ``,
    `**Que necesito que hagas:**`,
    `1. Encontra que collector(s) tienen esa tabla en target_tables:`,
    '```sql',
    `SELECT name, repo_path, schedule_cron, expected_frequency, enabled`,
    `  FROM xerenity.collector_definitions`,
    ` WHERE '${tbl}' = ANY(target_tables);`,
    '```',
    `2. Mira los runs recientes de ese(s) collector(s):`,
    '```sql',
    `SELECT collector_name, status, started_at, rows_inserted, error_message`,
    `  FROM xerenity.collector_runs`,
    ` WHERE collector_name IN (...los nombres del paso 1...)`,
    ` ORDER BY started_at DESC LIMIT 20;`,
    '```',
    `3. Diagnostico segun lo que encuentres:`,
    `   - **Si los runs son exitosos pero rows_inserted=0**: el collector corre pero no inserta. Lee el codigo con \`read_repo_file\` para entender por que (selector roto, fuente vacia, dedup mal armado).`,
    `   - **Si hay runs failed**: lee el error_message + traceback y diagnostica como un fallo normal.`,
    `   - **Si no hay runs recientes**: el cron esta mal o el workflow esta deshabilitado.`,
    `   - **Si los runs son recientes y exitosos pero la tabla sigue stale**: el collector quizas escribe a otra tabla, o hay un filtro.`,
    `4. Propone un fix concreto si es bug de codigo, o una accion (re-habilitar workflow, re-ejecutar, contactar fuente externa) si es operacional.`,
    ``,
    `Solo diagnostico — yo aplico cambios despues.`,
  ].filter(Boolean).join('\n');
};

const buildEmptyRunPrompt = (alert: DiagnoseAlert): string => {
  const md = (alert.metadata ?? {}) as Record<string, unknown>;
  const ghUrl = typeof md.gh_run_url === 'string' ? md.gh_run_url : null;
  return [
    `Un collector corrio exitosamente pero no escribio NINGUNA fila. Ayudame a entender por que.`,
    ``,
    `**Datos**`,
    `- Collector: \`${alert.collector_name ?? 'desconocido'}\``,
    ghUrl ? `- GitHub Actions run: ${ghUrl}` : null,
    ``,
    `**Que necesito que hagas:**`,
    `1. Encontra repo_path y target_tables con \`query_database\`:`,
    '```sql',
    `SELECT repo_path, target_tables FROM xerenity.collector_definitions WHERE name = '${alert.collector_name}';`,
    '```',
    `2. Mira los ultimos runs:`,
    '```sql',
    `SELECT status, rows_inserted, started_at FROM xerenity.collector_runs`,
    ` WHERE collector_name = '${alert.collector_name}' ORDER BY started_at DESC LIMIT 10;`,
    '```',
    `3. Lee el script con \`read_repo_file\`. Buscá:`,
    `   - Selectores HTML / regex / parser que pueden retornar None silenciosamente`,
    `   - Filtros incrementales (\`WHERE date > last_date\`) que pueden estar saltando todo`,
    `   - Llamadas a fuente externa que pueden devolver array vacio sin error`,
    `   - Lógica de skip/early-return`,
    `4. Diagnostica y proponé un fix.`,
    ``,
    `Solo diagnostico — yo aplico cambios despues.`,
  ].filter(Boolean).join('\n');
};

const buildDiagnosePrompt = (alert: DiagnoseAlert): string => {
  switch (alert.source) {
    case 'run_failed':  return buildRunFailedPrompt(alert);
    case 'table_stale': return buildTableStalePrompt(alert);
    case 'empty_run':   return buildEmptyRunPrompt(alert);
    default: {
      // Generic fallback for missed_run or future sources.
      return [
        `Estoy debuggeando una alerta del monitor de Xerenity (source=${alert.source}).`,
        `Collector: \`${alert.collector_name ?? 'n/a'}\`. Tabla: \`${alert.table_name ?? 'n/a'}\`.`,
        `Detalle: ${alert.body ?? '(sin detalle)'}`,
        ``,
        `Investiga con \`query_database\` (xerenity.collector_definitions, xerenity.collector_runs) y \`read_repo_file\` ` +
        `si necesitas ver codigo. Diagnostica y propon un fix.`,
      ].join('\n');
    }
  }
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
    openChat,
    clearChat,
    sendMessage,
  } = useAppStore((s) => ({
    collectorOverview: s.collectorOverview,
    activeAlerts: s.activeAlerts,
    loadCollectorOverview: s.loadCollectorOverview,
    loadActiveAlerts: s.loadActiveAlerts,
    acknowledgeAlert: s.acknowledgeAlert,
    silenceAlert: s.silenceAlert,
    resolveAlert: s.resolveAlert,
    openChat: s.openChat,
    clearChat: s.clearChat,
    sendMessage: s.sendMessage,
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

  // Alerts not associated with a collector (table_stale, missed_run on
  // unknown collectors, etc.) don't show up in the per-collector counter
  // above — they need their own line so the header doesn't claim "0
  // critical" while 17 stale-table alerts are open in the side panel.
  const alertCounts = useMemo(() => {
    const critical = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warning  = activeAlerts.filter((a) => a.severity === 'warning').length;
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

  const handleDiagnose = (alert: typeof activeAlerts[number]) => {
    const prompt = buildDiagnosePrompt(alert);
    clearChat();
    openChat();
    // Defer the actual send to the next tick so the panel is mounted
    // and the user sees the message land in real time.
    setTimeout(() => { sendMessage(prompt); }, 50);
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
                        <th>Filas</th>
                        <th>Alertas abiertas</th>
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
                          <td>{formatRowsInserted(row.last_run?.rows_inserted)}</td>
                          <td>
                            {row.open_alerts > 0 ? (
                              <Badge bg="danger">{row.open_alerts}</Badge>
                            ) : (
                              <span style={{ color: '#ccc' }} title="0 alertas abiertas">—</span>
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
                          <td colSpan={9}>
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
                        <BsButton
                          size="sm"
                          variant="outline-primary"
                          title={
                            alert.source === 'table_stale'
                              ? 'Abre el chat con un prompt pre-cargado: tabla afectada + collectors que la pueblan. El agente investiga por qué la tabla está stale y propone un diagnóstico. NO modifica nada.'
                              : alert.source === 'empty_run'
                                ? 'Abre el chat con un prompt pre-cargado: el collector corrió pero insertó 0 filas. El agente lee el código y busca por qué (selector roto, filtro mal armado, fuente vacía). NO modifica nada.'
                                : 'Abre el chat con un prompt pre-cargado: traceback + nombre del collector. El agente leerá el código en xerenity-dm y propondrá un diagnóstico. NO modifica nada.'
                          }
                          onClick={() => handleDiagnose(alert)}
                        >
                          <Icon icon={faRobot} /> Diagnosticar con IA
                        </BsButton>
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
