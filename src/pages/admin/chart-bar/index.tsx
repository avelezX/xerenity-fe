'use client';

/**
 * /admin/chart-bar — Bloomberg-style search bar.
 *
 * Una sola input. Tipeás "TRM último mes" o "IBR 3M vs SOFR" → enter →
 * la API hace todo (resolve hybrid + fetch + ChartSpec) y la gráfica
 * aparece debajo. Sin LLM, sin friction.
 *
 * Para múltiples series: separar con " vs " o " | ".
 * Para período inline: poner "el query, período" — separado por coma.
 *   Ej: "TRM, último mes"  /  "IBR 3M vs SOFR 3M, q1 2024"
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Form, Spinner, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faMagnifyingGlass,
  faKeyboard,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import RoleGuard from 'src/components/RoleGuard';
import useAppStore from 'src/store';
import ChatChart from 'src/components/chat/ChatChart';
import type { ChartSpec } from 'src/types/chat';
import type {
  FindAndChartResult,
  FindAndChartMeta,
} from 'src/lib/resolver/findAndChart';

const Page = styled.div`
  padding: 16px 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Bar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;

  .form-control {
    font-size: 18px;
    padding: 14px 18px;
    border: 2px solid #302b63;
    border-radius: 8px;
    background: #1a1a1a;
    color: #fff;
    font-family: 'JetBrains Mono', 'Courier New', monospace;

    &::placeholder {
      color: #6b6b8d;
    }

    &:focus {
      box-shadow: 0 0 0 3px rgba(48, 43, 99, 0.2);
      background: #1a1a1a;
      color: #fff;
      border-color: #4a44a0;
    }
  }
`;

const Hint = styled.div`
  font-size: 12px;
  color: #888;
  margin-bottom: 16px;
  font-family: 'JetBrains Mono', monospace;

  code {
    background: #f3f3f7;
    padding: 2px 6px;
    border-radius: 3px;
    color: #302b63;
    font-size: 11px;
  }
`;

const ChartCard = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
  margin-bottom: 16px;
`;

const MatchesRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 12px;

  .match-chip {
    background: #f3f3f7;
    border: 1px solid #d8d8e6;
    border-radius: 12px;
    padding: 4px 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .match-chip code {
    font-size: 11px;
    color: #6b6b8d;
  }
  .conf {
    font-weight: 700;
    color: #302b63;
  }
`;

const ErrorBox = styled.div`
  background: #fdf3f4;
  border: 1px solid #f5c6cb;
  color: #761c1c;
  padding: 14px 18px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
`;

const WarningBox = styled.div`
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #7a5a00;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 12px;

  strong { display: block; margin-bottom: 4px; }
`;

const PLACEHOLDER = 'TRM último mes  ·  IBR 3M vs SOFR 3M  ·  inflación q1 2024';

interface ParsedInput {
  queries: string[];
  periodText?: string;
}

// Parse the input bar:
//   "TRM" → {queries: ["TRM"]}
//   "TRM vs USD" → {queries: ["TRM", "USD"]}
//   "TRM, ultimo mes" → {queries: ["TRM"], periodText: "ultimo mes"}
//   "IBR 3M vs SOFR 3M, q1 2024" → {queries: ["IBR 3M", "SOFR 3M"], periodText: "q1 2024"}
function parseBar(input: string): ParsedInput {
  const t = input.trim();
  if (!t) return { queries: [] };

  // Split off period (everything after the last comma, IF it looks like a period)
  const commaIdx = t.lastIndexOf(',');
  let queriesPart = t;
  let periodText: string | undefined;
  if (commaIdx > 0) {
    queriesPart = t.slice(0, commaIdx).trim();
    periodText = t.slice(commaIdx + 1).trim();
  }

  // Split queries by " vs " or " | "
  const queries = queriesPart
    .split(/\s+(?:vs|\|)\s+/i)
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  return { queries, periodText };
}

const ChartBarPage = () => {
  const userProfile = useAppStore((s) => s.userProfile);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FindAndChartResult | null>(null);

  useEffect(() => {
    if (!userProfile) loadUserProfile();
  }, [userProfile, loadUserProfile]);

  const onSubmit = useCallback(async () => {
    const parsed = parseBar(input);
    if (parsed.queries.length === 0) {
      toast.warn('Tipea algo');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const r = await fetch('/api/resolver/chart-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: parsed.queries,
          period_text: parsed.periodText,
        }),
      });
      const json = (await r.json()) as FindAndChartResult & { error?: string };
      if (!r.ok) {
        toast.error(json.error ?? `HTTP ${r.status}`);
        setResult(json);
        return;
      }
      setResult(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [input]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onSubmit();
    },
    [onSubmit],
  );

  return (
    <CoreLayout>
      <Container fluid>
        <RoleGuard
          requiredRole="super_admin"
          fallback={
            <Page>
              <p className="text-muted">No tenes permisos para acceder a esta pagina.</p>
            </Page>
          }
        >
          <Page>
            <PageTitle>
              <Icon icon={faChartLine} />
              <h4>Chart Bar — Bloomberg-style search</h4>
            </PageTitle>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 18 }}>
              Una sola input. Sin LLM. Tipea, enter, gráfica.
            </p>

            <Bar>
              <Form.Control
                type="text"
                placeholder={PLACEHOLDER}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                autoFocus
              />
              <Button
                variant="primary"
                onClick={onSubmit}
                disabled={loading || !input.trim()}
                style={{ height: 52, padding: '0 24px' }}
              >
                {loading ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <Icon icon={faMagnifyingGlass} />
                )}
              </Button>
            </Bar>

            <Hint>
              <Icon icon={faKeyboard} /> Sintaxis: <code>query</code> ·{' '}
              <code>query vs query</code> (compara) ·{' '}
              <code>query, periodo</code> (rango).
              Periodos: <code>hoy</code>, <code>ultimo mes</code>,{' '}
              <code>ultimos 30 dias</code>, <code>q1 2024</code>,{' '}
              <code>octubre 2024</code>, <code>2023</code>.
            </Hint>

            {result?.error && !result.success && (
              <ErrorBox>
                <strong>Error:</strong> {result.error}
              </ErrorBox>
            )}

            {result?.warnings && result.warnings.length > 0 && (
              <WarningBox>
                <strong>Algunas series fallaron:</strong>
                {result.warnings.map((w) => (
                  <div key={w}>· {w}</div>
                ))}
              </WarningBox>
            )}

            {result?.chartData && (
              <ChartCard>
                <MatchesRow>
                  {result.matches?.map((m: FindAndChartMeta) => (
                    <div key={`${m.table_name}|${m.query}`} className="match-chip">
                      <span>{m.label}</span>
                      <code>{m.table_name}</code>
                      <span className="conf">{(m.confidence * 100).toFixed(0)}%</span>
                      <Badge bg="light" text="dark" style={{ fontSize: 10 }}>
                        {m.match_source}
                      </Badge>
                    </div>
                  ))}
                </MatchesRow>
                <ChatChart spec={result.chartData as ChartSpec} />
                <div
                  style={{
                    fontSize: 11,
                    color: '#888',
                    marginTop: 8,
                    textAlign: 'right',
                  }}
                >
                  Rango: {result.from} → {result.to} ({result.period_days} días)
                </div>
              </ChartCard>
            )}
          </Page>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default ChartBarPage;
