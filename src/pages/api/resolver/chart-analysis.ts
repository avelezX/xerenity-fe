// POST /api/resolver/chart-analysis
// Fase 4 del chart-bar: análisis IA bajo demanda (botón "Analizar").
//
// Diseño deliberado — NO es el agente:
//   * Sin loop agéntico, sin tools, sin acceso a DB para Claude. El FE ya tiene
//     los datos (respuesta de chart-direct) y envía un RESUMEN computado
//     (stats + serie decimada), no los puntos crudos.
//   * Una sola llamada a Messages API (claude-sonnet-5, elección del usuario
//     por costo), no-streaming: la respuesta es un párrafo corto (~$0.01).
//   * El camino crítico del chart-bar sigue sin LLM: la gráfica nunca espera
//     a Claude; esto solo corre al hacer clic.
//
// Auth: super_admin — mismo gate que /api/resolver/chart-direct.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export const config = {
  api: { bodyParser: { sizeLimit: '256kb' } },
};

export interface AnalysisSeriesStats {
  first: number;
  firstDate: string;
  last: number;
  lastDate: string;
  min: number;
  minDate: string;
  max: number;
  maxDate: string;
  change1M: number | null; // % vs ~30 días atrás (del último dato)
  change1Y: number | null; // % vs ~365 días atrás
  changeYTD: number | null; // % vs inicio del año del último dato
}

export interface AnalysisSeries {
  name: string;
  table: string;
  stats: AnalysisSeriesStats;
  /** Serie decimada (≤ MAX_POINTS) en orden ascendente: [fecha ISO, valor] */
  points: [string, number][];
}

interface RequestBody {
  series?: AnalysisSeries[];
  from?: string;
  to?: string;
  period?: string; // ventana visible seleccionada (1M...MAX)
  query?: string; // lo que tipeó el usuario en la barra
}

interface OkResponse {
  analysis: string;
}
interface ErrorResponse {
  error: string;
}

const MAX_SERIES = 5;
const MAX_POINTS = 200;

const SYSTEM_PROMPT = `Eres un analista financiero senior de Xerenity, una plataforma de datos financieros enfocada en el mercado colombiano (TRM, IBR, tasas del Banco de la República, inflación, TES, construcción) y global (Fed, SOFR, UST, monedas).

Recibirás datos resumidos de una o más series de tiempo: estadísticas clave y una muestra de puntos (fecha, valor).

Tu tarea: escribir un análisis breve en español (1 o 2 párrafos, máximo ~180 palabras) para un usuario profesional del mercado.

Reglas:
- Básate ÚNICAMENTE en los datos entregados y en contexto macroeconómico general ampliamente conocido (ciclo de tasas de BanRep y la Fed, pandemia 2020, inflación global 2021-2023, etc.).
- Describe el comportamiento: tendencia, niveles clave (máximos/mínimos históricos y cuándo ocurrieron), cambios de régimen, y la situación del nivel actual frente a la historia.
- Si hay dos o más series, compará su relación: correlación, divergencias, y el vínculo económico entre ellas.
- Al atribuir causas usa lenguaje prudente ("coincide con", "en un contexto de"); NUNCA inventes eventos, cifras o noticias recientes que no estén en los datos — tu conocimiento tiene un corte temporal.
- Sin preámbulos, sin disclaimers, sin títulos ni markdown: empezá directo con el análisis, en texto corrido.`;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateSeries(raw: unknown): AnalysisSeries[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SERIES) return null;
  const out: AnalysisSeries[] = [];
  for (const s of raw) {
    if (typeof s !== 'object' || s === null) return null;
    const { name, table, stats, points } = s as AnalysisSeries;
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) return null;
    if (typeof table !== 'string' || table.length > 200) return null;
    if (typeof stats !== 'object' || stats === null) return null;
    if (!isFiniteNumber(stats.last) || !isFiniteNumber(stats.min) || !isFiniteNumber(stats.max)) return null;
    if (!Array.isArray(points) || points.length === 0 || points.length > MAX_POINTS) return null;
    for (const p of points) {
      if (!Array.isArray(p) || typeof p[0] !== 'string' || !isFiniteNumber(p[1])) return null;
    }
    out.push({ name, table, stats, points });
  }
  return out;
}

function fmt(n: number): string {
  // Valores financieros: 2 decimales para tasas, sin decimales para niveles grandes.
  return Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(2);
}

function pct(n: number | null): string {
  return n === null ? 'n/d' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function buildUserPrompt(body: RequestBody, series: AnalysisSeries[]): string {
  const lines: string[] = [];
  if (body.query) lines.push(`Consulta del usuario: "${body.query}"`);
  lines.push(`Rango de datos: ${body.from ?? '?'} a ${body.to ?? '?'}. Ventana visible seleccionada: ${body.period ?? 'MAX'}.`);
  lines.push('');
  series.forEach((s) => {
    const st = s.stats;
    lines.push(`### SERIE: ${s.name} (tabla: ${s.table})`);
    lines.push(
      `Último: ${fmt(st.last)} (${st.lastDate}) · Primero: ${fmt(st.first)} (${st.firstDate}) · ` +
        `Mín: ${fmt(st.min)} (${st.minDate}) · Máx: ${fmt(st.max)} (${st.maxDate})`,
    );
    lines.push(`Variación: 1M ${pct(st.change1M)} · 1A ${pct(st.change1Y)} · YTD ${pct(st.changeYTD)}`);
    lines.push('Muestra (fecha,valor):');
    lines.push(s.points.map(([t, v]) => `${t},${fmt(v)}`).join(' '));
    lines.push('');
  });
  lines.push('Escribe el análisis.');
  return lines.join('\n');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkResponse | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth + role: idéntico a chart-direct (single source of truth: RPC en DB).
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  const body = (req.body ?? {}) as RequestBody;
  const series = validateSeries(body.series);
  if (!series) {
    return res.status(400).json({
      error: `body.series inválido (1-${MAX_SERIES} series, ≤${MAX_POINTS} puntos c/u)`,
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // Sonnet 5 corre thinking adaptativo por defecto y este cuenta contra
      // max_tokens — 2048 deja espacio para pensar + el párrafo (~300 tokens).
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(body, series) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'La API no devolvió texto de análisis' });
    }
    return res.status(200).json({ analysis: text });
  } catch (error) {
    // Errores de la API mapeados a mensajes accionables.
    if (error instanceof Anthropic.APIError) {
      const msg = error.message ?? '';
      if (msg.includes('credit balance')) {
        return res.status(402).json({
          error:
            'Sin créditos en la cuenta de Anthropic. Recargar en console.anthropic.com → Plans & Billing (el chat del agente usa la misma cuenta).',
        });
      }
      if (error.status === 429) {
        return res.status(429).json({ error: 'Límite de la API de Anthropic alcanzado. Intenta en unos minutos.' });
      }
      return res.status(502).json({ error: `Error de API de Anthropic: ${msg}` });
    }
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: msg });
  }
}
