'use client';

// SaludCard — top-of-page health digest for a collector.
//
// Surfaces the same diagnostic signals a human would otherwise compute
// from SQL: human-readable cron, expected cadence vs latest data,
// success/empty/failure rate over the last 30 runs, and a 30-run
// sparkline. Goal: when triaging, you should be able to tell a "0 rows
// by design" daily collector from one that's actually broken without
// touching the database.

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import cronstrue from 'cronstrue/i18n';
import { Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleXmark,
  faClock,
  faArrowUpRightFromSquare,
  faFileCode,
} from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';
import type {
  CollectorFullDetail,
  CollectorTableSeries,
  CollectorRunStats,
  CollectorRunStatRecent,
  SliceBreakdown,
} from 'src/types/catalog';

// ─────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────

const Card = styled.section`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 14px 18px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr) auto;
  gap: 16px 24px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const Block = styled.div`
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

const Verdict = styled.div<{ $tone: 'ok' | 'warn' | 'bad' | 'unknown' }>`
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  border-left: 4px solid
    ${(p) => {
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

const Sparkline = styled.div`
  display: flex;
  gap: 1px;
  margin-top: 4px;
  align-items: flex-end;
  height: 22px;
`;

const SparkSlot = styled.div<{ $color: string; $h: number }>`
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

const StatGrid = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 10px;
  font-size: 12px;
  margin: 0;
  dt { color: #777; font-weight: 500; }
  dd { margin: 0; color: #222; font-weight: 600; }
`;

const GhButton = styled.a`
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

  &:hover {
    background: #1b1f23;
  }
`;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<CollectorRunStatRecent['status'], string> = {
  success: '#28a745',
  running: '#5bc0de',
  failed: '#dc3545',
  timeout: '#6c757d',
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours}h`;
  const days = Math.round(hours / 24);
  return `hace ${days}d`;
};

const safeCronHuman = (cron: string | null): string | null => {
  if (!cron) return null;
  try {
    return cronstrue.toString(cron, { locale: 'es' });
  } catch {
    return null;
  }
};

// Convert "expected_frequency" interval string (e.g. "1 day") into hours.
// Treats hours/days roughly so we can compare against last_data age.
// Returns NULL when the interval doesn't parse.
const expectedFrequencyHours = (raw: string | null): number | null => {
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

// Highest-priority last_date across the collector's target tables.
// We look at SliceBreakdown rows (skip SliceError rows). If no series
// data is available (e.g. table has no meta or no rows), returns NULL.
const computeLatestData = (series: CollectorTableSeries[]): string | null => {
  let latest: string | null = null;
  series.forEach((s) => {
    s.slices.forEach((sl) => {
      if ('error' in sl) return;
      const slice = sl as SliceBreakdown;
      if (slice.last_date && (!latest || slice.last_date > latest)) {
        latest = slice.last_date;
      }
    });
  });
  return latest;
};

// Compose a verdict from the available signals. Returns:
//   - "ok"    → fresh data + recent successful run
//   - "warn"  → partially fresh OR mostly empty but data still flowing
//   - "bad"   → data older than 2× expected frequency, or last run failed
//   - "unknown" → not enough data to judge
//
// Ratio reasoning: a daily-publish source whose collector polls 3×/day
// will sit at ~67% empty by design. We only flag "warn" on the empty
// rate when we ALSO see no fresh data — otherwise empties are normal.
const buildVerdict = (
  detail: CollectorFullDetail,
  latestData: string | null,
): { tone: 'ok' | 'warn' | 'bad' | 'unknown'; title: string; explain: string } => {
  const stats = detail.run_stats;
  const lastRun = stats?.last_run_at ?? null;
  const expectedH = expectedFrequencyHours(detail.definition.expected_frequency);

  if (!stats || stats.total === 0) {
    return {
      tone: 'unknown',
      title: 'Sin runs registrados',
      explain: 'Este collector aún no tiene runs en xerenity.collector_runs.',
    };
  }

  const lastFailed = stats.recent[0]?.status === 'failed' || stats.recent[0]?.status === 'timeout';
  const ageH = latestData ? (Date.now() - new Date(latestData).getTime()) / 3.6e6 : null;

  if (lastFailed) {
    return {
      tone: 'bad',
      title: 'Último run falló',
      explain: `El último run terminó en ${stats.recent[0].status} ${formatRelative(stats.recent[0].started_at)}. Revisar traceback abajo.`,
    };
  }

  if (expectedH !== null && ageH !== null && ageH > expectedH * 2) {
    return {
      tone: 'bad',
      title: `Datos atrasados (${ageH.toFixed(0)}h)`,
      explain: `Cadencia esperada ${expectedH}h. Última fila ${formatRelative(latestData)}. Más del doble del rango.`,
    };
  }

  if (expectedH !== null && ageH !== null && ageH > expectedH * 1.25) {
    return {
      tone: 'warn',
      title: `Datos un poco atrasados (${ageH.toFixed(0)}h)`,
      explain: `Cadencia esperada ${expectedH}h. Última fila ${formatRelative(latestData)}.`,
    };
  }

  if ((stats.empty_rate_pct ?? 0) >= 50) {
    return {
      tone: 'ok',
      title: 'Patrón "muchos runs vacíos por diseño"',
      explain: `${stats.empty_rate_pct}% de los runs exitosos no insertaron filas. Lo común cuando la fuente publica menos seguido que el cron. La data fluye (última fila ${formatRelative(latestData)}).`,
    };
  }

  if (lastRun && stats.last_data_run_at) {
    return {
      tone: 'ok',
      title: 'Sano',
      explain: `Última fila ${formatRelative(latestData)} · último run con data ${formatRelative(stats.last_data_run_at)}.`,
    };
  }

  return {
    tone: 'unknown',
    title: 'No se puede evaluar',
    explain: 'Información insuficiente — revisa runs y datos manualmente.',
  };
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const SaludCard: React.FC<{ collectorName: string }> = ({ collectorName }) => {
  const { detail, loadDetail } = useAppStore((s) => ({
    detail: s.catalogDetail[collectorName],
    loadDetail: s.loadCollectorDetail,
  }));

  useEffect(() => {
    if (!detail) loadDetail(collectorName);
  }, [collectorName, detail, loadDetail]);

  const latestData = useMemo(
    () => (detail ? computeLatestData(detail.series ?? []) : null),
    [detail],
  );

  if (!detail) {
    return (
      <Card>
        <Block>
          <em style={{ color: '#888', fontSize: 12 }}>Cargando salud del collector…</em>
        </Block>
      </Card>
    );
  }

  const def = detail.definition;
  const stats = detail.run_stats;
  const cronHuman = safeCronHuman(def.schedule_cron);
  const verdict = buildVerdict(detail, latestData);

  // GitHub workflow URL (best-effort). Falls back to repo-level link.
  const ghHref = (() => {
    if (!def.repo) return null;
    if (def.workflow_file) {
      return `https://github.com/avelezX/${def.repo}/blob/main/${def.workflow_file}`;
    }
    return `https://github.com/avelezX/${def.repo}`;
  })();

  return (
    <Card>
      {/* Cron + cadencia */}
      <Block>
        <h5>Cron</h5>
        {def.schedule_cron ? (
          <>
            <div className="value"><code>{def.schedule_cron}</code></div>
            <div className="sub">
              {cronHuman ?? '(no se pudo traducir)'}
            </div>
            <div className="sub" style={{ marginTop: 6 }}>
              <strong>Cadencia esperada:</strong>{' '}
              {def.expected_frequency ? <code>{def.expected_frequency}</code> : <em>—</em>}
            </div>
          </>
        ) : (
          <div className="value"><em style={{ color: '#bbb' }}>sin cron</em></div>
        )}
      </Block>

      {/* Última data + último run */}
      <Block>
        <h5>Frescura</h5>
        <StatGrid>
          <dt>Última fila</dt>
          <dd>{latestData ? formatRelative(latestData) : <em style={{ color: '#bbb' }}>—</em>}</dd>
          <dt>Último run</dt>
          <dd>{stats?.last_run_at ? formatRelative(stats.last_run_at) : <em style={{ color: '#bbb' }}>—</em>}</dd>
          <dt>Último con data</dt>
          <dd>{stats?.last_data_run_at ? formatRelative(stats.last_data_run_at) : <em style={{ color: '#bbb' }}>—</em>}</dd>
        </StatGrid>
      </Block>

      {/* Stats últimos 30 + sparkline */}
      <Block>
        <h5>Últimos {stats?.total ?? 0} runs</h5>
        {stats && stats.total > 0 ? (
          <>
            <StatGrid>
              <dt>OK</dt>
              <dd style={{ color: '#28a745' }}>
                {stats.success} <span style={{ color: '#888', fontWeight: 400 }}>({stats.with_data} con data, {stats.empty} vacíos)</span>
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
            </StatGrid>
            <Sparkline title="Status de los últimos 30 runs (más reciente a la derecha)">
              {[...stats.recent].reverse().map((r) => {
                const h = r.rows_inserted && r.rows_inserted > 0 ? 100 : 50;
                return (
                  <SparkSlot
                    key={r.started_at}
                    $color={STATUS_COLOR[r.status]}
                    $h={h}
                    title={`${r.status} · ${formatRelative(r.started_at)} · ${r.rows_inserted ?? 0} filas`}
                  />
                );
              })}
            </Sparkline>
          </>
        ) : (
          <div className="value"><em style={{ color: '#bbb' }}>sin runs</em></div>
        )}
      </Block>

      {/* GH workflow link + estado */}
      <Block style={{ textAlign: 'right' }}>
        <h5>Workflow</h5>
        {ghHref ? (
          <GhButton href={ghHref} target="_blank" rel="noreferrer">
            <Icon icon={faFileCode} /> Editar YAML <Icon icon={faArrowUpRightFromSquare} style={{ fontSize: 9 }} />
          </GhButton>
        ) : (
          <em style={{ color: '#bbb', fontSize: 12 }}>—</em>
        )}
        <div className="sub" style={{ marginTop: 6 }}>
          <Badge bg={def.enabled ? 'success' : 'secondary'}>
            {def.enabled ? 'enabled' : 'DISABLED'}
          </Badge>{' '}
          <Badge bg="dark">{def.severity}</Badge>
        </div>
      </Block>

      {/* Verdicto a todo lo ancho */}
      <Verdict $tone={verdict.tone}>
        <Icon
          icon={verdictIcon(verdict.tone)}
          className="icon"
          style={{ color: verdictIconColor(verdict.tone) }}
        />
        <div className="copy">
          <strong>{verdict.title}</strong>
          <span>{verdict.explain}</span>
        </div>
      </Verdict>
    </Card>
  );
};

const verdictIcon = (tone: 'ok' | 'warn' | 'bad' | 'unknown') => {
  if (tone === 'ok') return faCircleCheck;
  if (tone === 'warn') return faCircleExclamation;
  if (tone === 'bad') return faCircleXmark;
  return faClock;
};

const verdictIconColor = (tone: 'ok' | 'warn' | 'bad' | 'unknown') => {
  if (tone === 'ok') return '#28a745';
  if (tone === 'warn') return '#f0ad4e';
  if (tone === 'bad') return '#dc3545';
  return '#6c757d';
};

export default SaludCard;
