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
  faRobot,
  faBook,
  faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import type { CollectorOverviewEnriched, Severity } from 'src/types/monitor';
import MonitorTable from './_MonitorTable';

const PageWrap = styled.div`
  padding: 16px 24px;
`;

// Canonical link to the operations playbook. Markdown is source of truth in
// xerenity-dm, GitHub renders it nicely (TOC, code highlight, edit button).
// Repo is private, so GitHub auth gates read access — no extra permission
// logic needed in the FE beyond the super_admin gate that already protects
// /admin/monitor.
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
// Diagnose-prompt builders
// ─────────────────────────────────────────────────────────────────
//
// All variants instruct the agent to investigate but NOT modify code.
// The user-applied fix loop stays manual until we add a controlled
// fix-collector tool.

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

const buildAlertDiagnosePrompt = (alert: DiagnoseAlert): string => {
  switch (alert.source) {
    case 'run_failed':  return buildRunFailedPrompt(alert);
    case 'table_stale': return buildTableStalePrompt(alert);
    case 'empty_run':   return buildEmptyRunPrompt(alert);
    default:
      return [
        `Estoy debuggeando una alerta del monitor de Xerenity (source=${alert.source}).`,
        `Collector: \`${alert.collector_name ?? 'n/a'}\`. Tabla: \`${alert.table_name ?? 'n/a'}\`.`,
        `Detalle: ${alert.body ?? '(sin detalle)'}`,
        ``,
        `Investiga con \`query_database\` (xerenity.collector_definitions, xerenity.collector_runs) y \`read_repo_file\` ` +
        `si necesitas ver codigo. Diagnostica y propon un fix.`,
      ].join('\n');
  }
};

// Per-row "investigate this collector" prompt — invoked from the IA
// button in the table. The agent gets enough context (source, target
// tables, last run state, review distribution summary) to start a
// generic health investigation without us pre-deciding what's wrong.
const buildCollectorDiagnosePrompt = (row: CollectorOverviewEnriched): string => {
  const lr = row.last_run;
  const reviewSummary = Object.entries(row.review_distribution)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return [
    `Investiga el estado de salud del collector \`${row.name}\` y diagnostica si algo no va bien.`,
    ``,
    `**Contexto rápido**`,
    `- Fuente: ${row.source ? `\`${row.source.name}\` (${row.source.label})` : '(sin fuente registrada — derivado o sin clasificar)'}`,
    `- Tablas destino: ${row.target_tables.length > 0 ? row.target_tables.map((t) => `\`${t}\``).join(', ') : '(ninguna)'}`,
    `- Categorías: ${row.categories.length > 0 ? row.categories.join(', ') : '—'}`,
    `- Países (datos): ${row.countries_data.length > 0 ? row.countries_data.join(', ') : '—'}`,
    `- Severity default: ${row.severity_default}${row.is_critical_any ? ' · ⭐ tabla crítica' : ''}`,
    `- Enabled: ${row.enabled ? 'sí' : 'NO'}`,
    `- Último run: ${lr ? `${lr.status} hace ${formatRelative(lr.started_at)} (${lr.rows_inserted ?? '—'} filas insertadas)` : 'nunca corrió'}`,
    `- Alertas abiertas: ${row.open_alerts}`,
    `- Estado revisión por par (collector,tabla): ${reviewSummary}`,
    ``,
    `**Pasos sugeridos**`,
    `1. \`query_database\` → \`SELECT repo_path, schedule_cron, expected_frequency FROM xerenity.collector_definitions WHERE name = '${row.name}';\``,
    `2. \`query_database\` → últimos 20 runs (\`xerenity.collector_runs\`) ordenados desc por started_at, mira tendencias de rows_inserted y errores.`,
    `3. Si el último run es failed o tiene rows_inserted=0, lee el script con \`read_repo_file\`.`,
    `4. Mira el contenido reciente de cada target_table — ¿last_date razonable dado expected_frequency?`,
    `5. Resumen final: ¿está sano, hay un bug latente, o hace falta acción operacional? Propón un fix concreto si aplica.`,
    ``,
    `Solo diagnostico — no modifiques código. Yo aplico cambios después.`,
  ].join('\n');
};

const DIAGNOSE_TOOLTIPS: Record<string, string> = {
  table_stale:
    'Abre el chat con un prompt pre-cargado: tabla afectada + collectors que la pueblan. ' +
    'El agente investiga por qué la tabla está stale y propone un diagnóstico. NO modifica nada.',
  empty_run:
    'Abre el chat con un prompt pre-cargado: el collector corrió pero insertó 0 filas. ' +
    'El agente lee el código y busca por qué (selector roto, filtro mal armado, fuente vacía). NO modifica nada.',
  run_failed:
    'Abre el chat con un prompt pre-cargado: traceback + nombre del collector. ' +
    'El agente leerá el código en xerenity-dm y propondrá un diagnóstico. NO modifica nada.',
};

const diagnoseTooltip = (source: string): string =>
  DIAGNOSE_TOOLTIPS[source] ??
  'Abre el chat con un prompt pre-cargado para que el agente investigue esta alerta. NO modifica nada.';


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
    openChat,
    clearChat,
    sendMessage,
  } = useAppStore((s) => ({
    collectorOverviewEnriched: s.collectorOverviewEnriched,
    activeAlerts: s.activeAlerts,
    loadCollectorOverviewEnriched: s.loadCollectorOverviewEnriched,
    loadActiveAlerts: s.loadActiveAlerts,
    acknowledgeAlert: s.acknowledgeAlert,
    silenceAlert: s.silenceAlert,
    resolveAlert: s.resolveAlert,
    openChat: s.openChat,
    clearChat: s.clearChat,
    sendMessage: s.sendMessage,
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

  const launchAgent = (prompt: string) => {
    clearChat();
    openChat();
    setTimeout(() => { sendMessage(prompt); }, 50);
  };

  const handleDiagnoseAlert = (alert: typeof activeAlerts[number]) => {
    launchAgent(buildAlertDiagnosePrompt(alert));
  };

  const handleDiagnoseRow = (row: CollectorOverviewEnriched) => {
    launchAgent(buildCollectorDiagnosePrompt(row));
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
                <MonitorTable
                  rows={collectorOverviewEnriched}
                  onDiagnose={handleDiagnoseRow}
                />
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
                        <BsButton
                          size="sm"
                          variant="outline-primary"
                          title={diagnoseTooltip(alert.source)}
                          onClick={() => handleDiagnoseAlert(alert)}
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
