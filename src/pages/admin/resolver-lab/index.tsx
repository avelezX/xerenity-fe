'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Form, Badge, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faThumbsUp,
  faThumbsDown,
  faFlask,
  faClock,
  faLightbulb,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import type {
  ResolverMatch,
  Vote,
  ResolverLogEntry,
  ResolverSuggestion,
  ResolverMatchScore,
} from 'src/types/resolver';
import {
  resolveQuery,
  logResolverQuery,
  rateResolverMatch,
  listRecentResolverLogs,
  listResolverMatchScore,
  suggestSimilar,
  embedText,
} from 'src/models/resolver';

const RESULT_LIMIT = 15;

const confidenceColor = (v: number): string => {
  if (v >= 0.7) return '#198754';
  if (v >= 0.4) return '#f0ad4e';
  return '#dc3545';
};

const scorePctClass = (pct: number): 'good' | 'warn' | 'bad' => {
  if (pct >= 70) return 'good';
  if (pct >= 40) return 'warn';
  return 'bad';
};

const sourceColor = (s: string): string => {
  if (s.startsWith('exact')) return '#198754';
  if (s.startsWith('alias')) return '#20c997';
  if (s.startsWith('semantic')) return '#6610f2';
  if (s.startsWith('trgm')) return '#0d6efd';
  return '#6c757d';
};

const emptyMessage = (
  loading: boolean,
  searched: boolean,
  hasSuggestions: boolean,
): string => {
  if (loading) return 'Resolviendo...';
  if (searched) {
    return hasSuggestions
      ? 'Sin matches exactos. ¿Quizás quisiste decir alguna de estas?'
      : 'Sin matches. Probá otra forma, o agregá la entrada al catálogo (data_tables_meta / data_slice_dictionary).';
  }
  return 'Tipea una query y dale Resolve.';
};

const Page = styled.div`
  padding: 16px 24px;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;

  .form-control {
    font-size: 16px;
    padding: 10px 14px;
  }
`;

const ResultsCard = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 0;
  overflow: hidden;
  margin-bottom: 24px;

  .table { margin-bottom: 0; }
  .table thead th {
    background: #302b63 !important;
    color: #fff !important;
    border-color: #3d3580 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    padding: 10px 12px !important;
    vertical-align: middle !important;
  }
  .table tbody td {
    font-size: 13px;
    vertical-align: middle !important;
    padding: 8px 12px !important;
    border-color: #eee !important;
  }
  .table tbody tr:nth-child(even) { background: #fafaff; }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 48px 8px;
`;

const ConfidenceBar = styled.div<{ $value: number }>`
  display: inline-block;
  width: 60px;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  position: relative;
  vertical-align: middle;
  margin-right: 8px;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    width: ${(p) => Math.min(100, Math.max(0, p.$value * 100))}%;
    background: ${(p) => confidenceColor(p.$value)};
    border-radius: 4px;
  }
`;

const voteColor = (kind: 'up' | 'down'): string =>
  (kind === 'up' ? '#198754' : '#dc3545');

const VoteButton = styled.button<{ $active?: boolean; $kind: 'up' | 'down' }>`
  border: none;
  background: ${(p) => (p.$active ? voteColor(p.$kind) : '#f3f3f7')};
  color: ${(p) => (p.$active ? '#fff' : '#666')};
  width: 32px;
  height: 28px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${(p) => voteColor(p.$kind)};
    color: #fff;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SourceBadge = styled(Badge)<{ $source: string }>`
  font-size: 10px !important;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.4px;
  background: ${(p) => sourceColor(p.$source)} !important;
`;

const SuggestionsPanel = styled.div`
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 8px;
  padding: 14px 18px;
  margin: 0 0 16px 0;

  .heading {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a06b00;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row {
    padding: 6px 0;
    border-bottom: 1px solid #ffe082;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    transition: background 0.1s;

    &:hover { background: #fff3c4; }
    &:last-child { border-bottom: none; }
  }
  .row .label { flex: 1; min-width: 0; font-weight: 500; color: #4a3500; }
  .row .meta  { font-size: 11px; color: #886500; }
  .row .sim   { font-size: 11px; color: #b07900; font-weight: 600; }
`;

const ScoreboardPanel = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 16px;
  margin-top: 16px;

  h5 {
    font-size: 13px;
    font-weight: 700;
    margin: 0 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #302b63;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  table { width: 100%; font-size: 12px; }
  table th {
    text-align: left;
    color: #666;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.3px;
    padding: 4px 8px;
    border-bottom: 1px solid #eee;
  }
  table td {
    padding: 6px 8px;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: middle;
  }
  table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pct {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 11px;
  }
  .pct.good { background: #d1f0e0; color: #0d5a32; }
  .pct.warn { background: #fdf3d4; color: #7a5a00; }
  .pct.bad  { background: #fad7d7; color: #761c1c; }
`;

const RecentQueriesPanel = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 16px;

  h5 {
    font-size: 13px;
    font-weight: 700;
    margin: 0 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #302b63;
  }
  .recent-row {
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;

    &:hover { background: #fafaff; }
    &:last-child { border-bottom: none; }
  }
  .recent-row .query { font-weight: 500; color: #333; }
  .recent-row .meta  { font-size: 11px; color: #888; }
`;

const matchKey = (m: ResolverMatch): string =>
  `${m.table_name}|${m.slice_value ?? ''}`;

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours}h`;
  const days = Math.round(hours / 24);
  return `hace ${days}d`;
};

const ResolverLabPage = () => {
  const userProfile = useAppStore((s) => s.userProfile);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ResolverMatch[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [loading, setLoading] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Recent queries panel
  const [recent, setRecent] = useState<ResolverLogEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Empty state suggestions ("did you mean")
  const [suggestions, setSuggestions] = useState<ResolverSuggestion[]>([]);

  // Scoreboard (resolver_match_score aggregate)
  const [scoreboard, setScoreboard] = useState<ResolverMatchScore[]>([]);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);

  useEffect(() => {
    if (!userProfile) loadUserProfile();
  }, [userProfile, loadUserProfile]);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    const r = await listRecentResolverLogs(15);
    setRecentLoading(false);
    if (r.error) {
      // Silent: probably non-super_admin; RoleGuard already gated the page.
      return;
    }
    setRecent(r.data ?? []);
  }, []);

  const loadScoreboard = useCallback(async () => {
    setScoreboardLoading(true);
    const r = await listResolverMatchScore();
    setScoreboardLoading(false);
    if (r.error) return;
    setScoreboard(r.data ?? []);
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'super_admin') {
      loadRecent();
      loadScoreboard();
    }
  }, [userProfile, loadRecent, loadScoreboard]);

  const onResolve = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      toast.warn('Tipea algo para resolver');
      return;
    }
    setLoading(true);
    setSearched(true);
    setMatches([]);
    setVotes({});
    setLogId(null);

    // Hybrid path: try to get an embedding first. If it fails (no API key,
    // OpenAI down, no super_admin profile yet), the resolver falls back
    // gracefully to literal-only via the embedding=null branch.
    const embedRes = await embedText(q);
    let embedding: number[] | null = null;
    if (embedRes.error) {
      toast.info(`Sin capa semántica para esta query: ${embedRes.error}`);
    } else {
      embedding = embedRes.data;
    }

    const r = await resolveQuery(q, RESULT_LIMIT, embedding);
    if (r.error) {
      toast.error(r.error);
      setLoading(false);
      return;
    }
    const results = r.data ?? [];
    setMatches(results);
    setSuggestions([]);

    // If primary resolve returned nothing, fetch loose suggestions
    if (results.length === 0) {
      const sugg = await suggestSimilar(q, 5);
      if (!sugg.error && sugg.data) {
        setSuggestions(sugg.data);
      }
    }

    // Fire-and-mostly-forget the log. If it fails we still let the user vote
    // — voting will just fail too, with a clear error.
    const logRes = await logResolverQuery(q, results);
    if (logRes.error) {
      toast.warn(`No se pudo registrar la query: ${logRes.error}`);
    } else if (logRes.data) {
      setLogId(logRes.data);
      // Refresh recent panel without blocking.
      loadRecent();
    }

    setLoading(false);
  }, [query, loadRecent]);

  const onVote = useCallback(
    async (m: ResolverMatch, vote: Vote) => {
      if (!logId) {
        toast.error('No hay log registrado para esta query — re-tipea y resolve.');
        return;
      }
      const key = matchKey(m);
      setVoteSubmitting(key);
      const r = await rateResolverMatch(logId, m.table_name, m.slice_value, vote);
      setVoteSubmitting(null);
      if (!r.ok) {
        toast.error(r.error ?? 'Error registrando voto');
        return;
      }
      setVotes((prev) => ({ ...prev, [key]: vote }));
      // Scoreboard depende del feedback; refresh sin bloquear
      loadScoreboard();
    },
    [logId, loadScoreboard],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onResolve();
    },
    [onResolve],
  );

  const totals = useMemo(() => {
    const ups = Object.values(votes).filter((v) => v === 1).length;
    const downs = Object.values(votes).filter((v) => v === -1).length;
    return { ups, downs };
  }, [votes]);

  return (
    <CoreLayout>
      <Container fluid>
        <RoleGuard
          requiredRole="super_admin"
          fallback={
            <Page>
              <Row>
                <Col>
                  <p className="text-muted">
                    No tienes permisos para acceder a esta pagina.
                  </p>
                </Col>
              </Row>
            </Page>
          }
        >
          <Page>
            <PageTitle>
              <Icon icon={faFlask} />
              <h4>Resolver Lab — MVP interno</h4>
            </PageTitle>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 24 }}>
              Probador del resolver NL. Tipea una query, marca thumbs up/down en cada
              resultado para alimentar el feedback corpus. Solo super_admin.
            </p>

            <SearchRow>
              <Form.Control
                type="text"
                placeholder='Ej: "IBR 3M", "inflacion Colombia", "TRM", "SOFR ON spread"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                autoFocus
              />
              <Button
                variant="primary"
                onClick={onResolve}
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" /> Resolviendo...
                  </>
                ) : (
                  <>
                    <Icon icon={faMagnifyingGlass} /> Resolve
                  </>
                )}
              </Button>
            </SearchRow>

            <Row>
              <Col lg={8}>
                <ResultsCard>
                  {matches.length > 0 ? (
                    <table className="table table-hover table-sm">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>Match</th>
                          <th>Table</th>
                          <th>Slice</th>
                          <th>Categoría</th>
                          <th>Confidence</th>
                          <th>Source</th>
                          <th style={{ width: 92 }}>Vote</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m, i) => {
                          const k = matchKey(m);
                          const v = votes[k];
                          const isSubmitting = voteSubmitting === k;
                          return (
                            <tr key={k}>
                              <td>{i + 1}</td>
                              <td>
                                <strong>{m.label ?? m.table_label ?? '—'}</strong>
                                {m.table_label && m.label !== m.table_label && (
                                  <div style={{ fontSize: 11, color: '#888' }}>
                                    {m.table_label}
                                  </div>
                                )}
                              </td>
                              <td>
                                <code style={{ fontSize: 12 }}>{m.table_name}</code>
                              </td>
                              <td>
                                {m.slice_value ? (
                                  <span>
                                    <code style={{ fontSize: 12 }}>{m.slice_value}</code>
                                    {m.slice_column && (
                                      <div style={{ fontSize: 10, color: '#aaa' }}>
                                        {m.slice_column}
                                      </div>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                {m.category ? (
                                  <Badge bg="light" text="dark" style={{ fontSize: 11 }}>
                                    {m.category}
                                  </Badge>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                <ConfidenceBar $value={m.confidence} />
                                <span style={{ fontSize: 12, fontWeight: 600 }}>
                                  {(m.confidence * 100).toFixed(0)}%
                                </span>
                              </td>
                              <td>
                                <SourceBadge $source={m.match_source}>
                                  {m.match_source}
                                </SourceBadge>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <VoteButton
                                    $kind="up"
                                    $active={v === 1}
                                    disabled={isSubmitting || !logId}
                                    title="Match correcto"
                                    onClick={() => onVote(m, 1)}
                                  >
                                    <Icon icon={faThumbsUp} />
                                  </VoteButton>
                                  <VoteButton
                                    $kind="down"
                                    $active={v === -1}
                                    disabled={isSubmitting || !logId}
                                    title="Match incorrecto"
                                    onClick={() => onVote(m, -1)}
                                  >
                                    <Icon icon={faThumbsDown} />
                                  </VoteButton>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState>
                      {emptyMessage(loading, searched, suggestions.length > 0)}
                    </EmptyState>
                  )}
                </ResultsCard>

                {matches.length === 0 && suggestions.length > 0 && !loading && (
                  <SuggestionsPanel>
                    <div className="heading">
                      <Icon icon={faLightbulb} /> ¿Quisiste decir...?
                    </div>
                    {suggestions.map((s) => {
                      const sk = `${s.table_name}|${s.slice_value ?? ''}`;
                      const tip = s.label ?? s.table_label ?? s.table_name;
                      return (
                        <div
                          key={sk}
                          className="row"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setQuery(tip);
                            setSuggestions([]);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setQuery(tip);
                              setSuggestions([]);
                            }
                          }}
                          title={`Click para usar "${tip}"`}
                        >
                          <span className="label">{tip}</span>
                          <span className="meta">
                            <code>{s.table_name}</code>
                            {s.slice_value ? ` · ${s.slice_value}` : ''}
                            {s.category ? ` · ${s.category}` : ''}
                          </span>
                          <span className="sim">{(s.similarity * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </SuggestionsPanel>
                )}

                {matches.length > 0 && (
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
                    Top {matches.length} de {RESULT_LIMIT} solicitados ·{' '}
                    Votos: <strong style={{ color: '#198754' }}>{totals.ups} 👍</strong>{' '}
                    /{' '}
                    <strong style={{ color: '#dc3545' }}>{totals.downs} 👎</strong>{' '}
                    · Log id:{' '}
                    {logId ? (
                      <code style={{ fontSize: 11 }}>{logId.slice(0, 8)}…</code>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                )}
              </Col>

              <Col lg={4}>
                <RecentQueriesPanel>
                  <h5>
                    <Icon icon={faClock} /> Queries recientes
                  </h5>
                  {recentLoading && (
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      Cargando...
                    </p>
                  )}
                  {!recentLoading && recent.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      No hay queries registradas todavía.
                    </p>
                  )}
                  {recent.map((r) => (
                    <div
                      key={r.id}
                      className="recent-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => setQuery(r.query_text)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setQuery(r.query_text);
                        }
                      }}
                      title="Click para re-tipear"
                    >
                      <span className="query" style={{ flex: 1, minWidth: 0 }}>
                        {r.query_text}
                      </span>
                      <span className="meta">
                        {r.result_count} · {formatRelative(r.created_at)}
                      </span>
                    </div>
                  ))}
                </RecentQueriesPanel>

                <ScoreboardPanel>
                  <h5>
                    <Icon icon={faChartLine} /> Scoreboard del cat&aacute;logo
                  </h5>
                  {scoreboardLoading && (
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      Cargando...
                    </p>
                  )}
                  {!scoreboardLoading && scoreboard.length === 0 && (
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      Sin votos a&uacute;n. Marc&aacute; thumbs en algunos resultados
                      para empezar.
                    </p>
                  )}
                  {scoreboard.length > 0 && (
                    <table>
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th className="num">👍</th>
                          <th className="num">👎</th>
                          <th className="num">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreboard.slice(0, 15).map((s) => {
                          const pct = s.pct_positive ?? 0;
                          const pctClass = scorePctClass(pct);
                          return (
                            <tr key={`${s.table_name}|${s.slice_value ?? ''}`}>
                              <td>
                                <code style={{ fontSize: 11 }}>{s.table_name}</code>
                                {s.slice_value && (
                                  <div style={{ fontSize: 10, color: '#888' }}>
                                    {s.slice_value}
                                  </div>
                                )}
                              </td>
                              <td className="num">{s.thumbs_up}</td>
                              <td className="num">{s.thumbs_down}</td>
                              <td className="num">
                                {s.pct_positive !== null ? (
                                  <span className={`pct ${pctClass}`}>
                                    {pct.toFixed(0)}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </ScoreboardPanel>
              </Col>
            </Row>
          </Page>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default ResolverLabPage;
