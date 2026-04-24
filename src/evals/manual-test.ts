/**
 * Manual test script for the Xerenity AI agent.
 * Tests common economics prompts and reports results.
 *
 * Usage: npx tsx src/evals/manual-test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { tools } from '../pages/api/chat/tools';

// Load env
const envPath = path.join(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx);
    if (!process.env[key]) process.env[key] = trimmed.slice(eqIdx + 1);
  });
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// buildSystemPrompt is now async and reads from DB. For manual test, use a minimal fallback prompt.
// Run this test from a context with Supabase connection (or refactor later to load skills in test).
const systemPrompt = 'Eres el asistente de IA de Xerenity. Use view_series para graficar series buscando tickers en xerenity.search_mv.';

// Synthetic responses for tool results
function syntheticResult(toolName: string, toolInput: Record<string, unknown>): string {
  if (toolName === 'query_database') {
    const sql = ((toolInput.sql as string) || '').toLowerCase();

    // Search for series
    if (sql.includes('search_mv') || sql.includes('banrep_serie') || sql.includes('public_series')) {
      // Return realistic tickers based on what they're searching for
      const results: Record<string, unknown>[] = [];

      if (sql.includes('ibr') && !sql.includes('inflac')) {
        results.push(
          { ticker: 'ibr_1m_ticker', display_name: 'IBR 1 mes', grupo: 'IBR' },
          { ticker: 'ibr_3m_ticker', display_name: 'IBR 3 meses', grupo: 'IBR' },
          { ticker: 'ibr_6m_ticker', display_name: 'IBR 6 meses', grupo: 'IBR' },
          { ticker: 'ibr_1y_ticker', display_name: 'IBR 1 año', grupo: 'IBR' },
        );
      } else if (sql.includes('trm') || sql.includes('representativa') || (sql.includes('usd') && sql.includes('cop'))) {
        results.push(
          { ticker: 'trm_ticker_001', display_name: 'Tasa Representativa del Mercado (TRM)', grupo: 'TRM' },
        );
      } else if (sql.includes('fic') || sql.includes('fondo') || sql.includes('renta fija')) {
        results.push(
          { ticker: 'fic_001', display_name: 'FIC Renta Fija AAA', grupo: 'FIC' },
          { ticker: 'fic_002', display_name: 'FIC Renta Fija Corto Plazo', grupo: 'FIC' },
          { ticker: 'fic_003', display_name: 'FIC Renta Fija Mediano Plazo', grupo: 'FIC' },
        );
      } else if (sql.includes('pib') && sql.includes('inflac')) {
        results.push(
          { ticker: 'pib_total_ticker', display_name: 'PIB Total - Precios Constantes 2015', grupo: 'Cuentas Nacionales' },
          { ticker: 'inflacion_ticker', display_name: 'Inflación total anual', grupo: 'Inflación' },
        );
      } else if (sql.includes('pib')) {
        results.push(
          { ticker: 'pib_total_ticker', display_name: 'PIB Total - Precios Constantes 2015', grupo: 'Cuentas Nacionales' },
        );
      } else if (sql.includes('pol') || sql.includes('interven') || sql.includes('monetaria')) {
        results.push(
          { ticker: 'c9f0f895fb98ab9159f51fd0297e236d', display_name: 'Tasa de Politica Monetaria', grupo: 'Política Monetaria' },
        );
      } else if (sql.includes('inflac')) {
        results.push(
          { ticker: 'inflacion_ticker', display_name: 'Inflación total anual', grupo: 'Inflación' },
        );
      } else if (sql.includes('base monetaria')) {
        results.push(
          { ticker: 'base_monetaria_ticker', display_name: 'Base Monetaria', grupo: 'Agregados' },
        );
      } else {
        results.push(
          { ticker: 'generic_ticker_1', display_name: 'Serie Genérica 1', grupo: 'Otros' },
        );
      }
      return JSON.stringify({ rows: results, rowCount: results.length });
    }

    // Other DB queries
    return JSON.stringify({ rows: [{ value: 4150, time: '2026-04-17' }], rowCount: 1 });
  }

  if (toolName === 'view_series') {
    return JSON.stringify({ success: true, message: 'Series cargadas en el graficador' });
  }

  if (toolName === 'navigate_to') {
    return JSON.stringify({ success: true });
  }

  return JSON.stringify({ success: true });
}

interface TestResult {
  prompt: string;
  loops: number;
  toolsCalled: string[];
  viewSeriesCalled: boolean;
  viewSeriesInput?: Record<string, unknown>;
  finalText: string;
  tokens: { input: number; output: number };
  durationMs: number;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  failReason?: string;
}

async function runTest(prompt: string): Promise<TestResult> {
  const start = Date.now();
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  const toolsCalled: string[] = [];
  let viewSeriesCalled = false;
  let viewSeriesInput: Record<string, unknown> | undefined;
  let finalText = '';
  let totalInput = 0;
  let totalOutput = 0;
  let loops = 0;
  const MAX_LOOPS = 8;

  while (loops < MAX_LOOPS) {
    loops += 1;

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    totalInput += resp.usage.input_tokens;
    totalOutput += resp.usage.output_tokens;

    // Collect text
    resp.content.forEach((b) => {
      if (b.type === 'text') finalText += b.text;
    });

    if (resp.stop_reason === 'end_turn') break;

    if (resp.stop_reason === 'tool_use') {
      const toolBlocks = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      toolBlocks.forEach((t) => {
        toolsCalled.push(t.name);
        if (t.name === 'view_series') {
          viewSeriesCalled = true;
          viewSeriesInput = t.input as Record<string, unknown>;
        }
      });

      messages.push({ role: 'assistant', content: resp.content });

      const results: Anthropic.ToolResultBlockParam[] = toolBlocks.map((t) => ({
        type: 'tool_result' as const,
        tool_use_id: t.id,
        content: syntheticResult(t.name, t.input as Record<string, unknown>),
      }));

      messages.push({ role: 'user', content: results });
    } else {
      break;
    }
  }

  const blocked = loops >= MAX_LOOPS;
  let status: 'PASS' | 'FAIL' | 'BLOCKED' = 'PASS';
  let failReason: string | undefined;

  if (blocked) {
    status = 'BLOCKED';
    failReason = `Hit max ${MAX_LOOPS} loops without completing`;
  } else if (!viewSeriesCalled && toolsCalled.includes('query_database')) {
    // Expected view_series but only got queries
    status = 'FAIL';
    failReason = 'Agent queried DB but never called view_series';
  }

  return {
    prompt,
    loops,
    toolsCalled,
    viewSeriesCalled,
    viewSeriesInput,
    finalText: finalText.slice(0, 200),
    tokens: { input: totalInput, output: totalOutput },
    durationMs: Date.now() - start,
    status,
    failReason,
  };
}

const TEST_PROMPTS = [
  // Basic charting
  'Graficame la TRM',
  'Graficame los diferentes plazos de IBR: 1 mes, 3 meses, 6 meses, 1 año',
  'Compara fondos FIC de renta fija',
  'Graficame la tasa de politica monetaria',
  // Compatibility & economic intelligence
  'Muestrame el PIB de Colombia vs la inflacion',  // Should warn about periodicity mismatch
  'Compara la inflacion con la tasa de politica monetaria', // Should suggest mensual inflation
  'Graficame la TRM vs el PIB trimestral', // Should warn: diaria vs trimestral
  // Value queries (should NOT chart)
  'Cual es la TRM hoy?',
];

async function main() {
  console.log('\n🤖 Xerenity Agent Manual Test\n');
  console.log('=' .repeat(70));

  const results: TestResult[] = [];

  for (const prompt of TEST_PROMPTS) {
    console.log(`\n📝 "${prompt}"`);
    const result = await runTest(prompt);
    results.push(result);

    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🔴';
    console.log(`   ${icon} ${result.status} | ${result.loops} loops | tools: ${result.toolsCalled.join(' → ')} | ${(result.durationMs/1000).toFixed(1)}s`);

    if (result.viewSeriesInput) {
      const tickers = (result.viewSeriesInput.tickers as string[]) || [];
      const names = (result.viewSeriesInput.names as string[]) || [];
      console.log(`   📊 view_series: ${names.join(', ')} (${tickers.length} series)`);
    }

    if (result.failReason) {
      console.log(`   ⚠️  ${result.failReason}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   PASS:  ${results.filter(r => r.status === 'PASS').length}`);
  console.log(`   FAIL:  ${results.filter(r => r.status === 'FAIL').length}`);
  console.log(`   BLOCKED: ${results.filter(r => r.status === 'BLOCKED').length}`);

  const totalTokens = results.reduce((acc, r) => acc + r.tokens.input + r.tokens.output, 0);
  const totalCost = results.reduce((acc, r) => acc + (r.tokens.input / 1e6) * 3 + (r.tokens.output / 1e6) * 15, 0);
  console.log(`   Tokens: ${totalTokens}`);
  console.log(`   Cost:   $${totalCost.toFixed(4)}`);
  console.log('');
}

main().catch(console.error);
