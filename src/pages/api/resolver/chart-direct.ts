// POST /api/resolver/chart-direct
// Bloomberg-bar path — sin LLM en el medio. Recibe text + period opcional,
// devuelve ChartSpec listo para renderizar. Pensado para el componente
// /admin/chart-bar (search bar global).
//
// Auth: super_admin (mismo gate que resolve_query durante MVP).

import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { findAndChart } from 'src/lib/resolver/findAndChart';
import type { FindAndChartResult } from 'src/lib/resolver/findAndChart';
import { parsePeriod } from 'src/utils/parsePeriod';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

interface RequestBody {
  query?: string;
  queries?: string[];
  period_text?: string;
  period_days?: number;
  chart_type?: 'line' | 'bar' | 'area';
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FindAndChartResult | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth + role check
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Use the DB-level is_super_admin() RPC so this gate matches what the
  // resolver/query_series functions check internally — single source of truth.
  // Reading user_profiles directly proved fragile in serverless context
  // (cookie/schema header handling); the RPC just works.
  const { data: isAdmin, error: adminError } = await supabase
    .schema('xerenity')
    .rpc('is_super_admin');

  if (adminError || !isAdmin) {
    return res.status(403).json({
      error: adminError
        ? `super_admin check failed: ${adminError.message}`
        : 'super_admin required',
    });
  }

  // Validate body
  const body = (req.body ?? {}) as RequestBody;
  const queries: string[] = (() => {
    if (Array.isArray(body.queries) && body.queries.length > 0) return body.queries;
    if (typeof body.query === 'string') return [body.query];
    return [];
  })();

  if (queries.length === 0) {
    return res.status(400).json({ error: 'body.query o body.queries es requerido' });
  }

  // Compute period: prefer period_text (NL parse), then explicit period_days, default 365
  let periodDays = 365;
  let from: string | undefined;
  let to: string | undefined;

  if (typeof body.period_text === 'string' && body.period_text.trim().length > 0) {
    const parsed = parsePeriod(body.period_text);
    periodDays = parsed.period_days;
    from = parsed.from.toISOString().slice(0, 10);
    to = parsed.to.toISOString().slice(0, 10);
  } else if (typeof body.period_days === 'number') {
    periodDays = Math.max(1, Math.min(3650, body.period_days));
  }

  // Call core
  const result = await findAndChart(
    {
      queries,
      period_days: periodDays,
      chart_type: body.chart_type,
      from,
      to,
    },
    supabase,
  );

  return res.status(result.success ? 200 : 400).json(result);
}
