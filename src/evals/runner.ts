import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '../pages/api/chat/system-prompt';
import { tools } from '../pages/api/chat/tools';
import { evaluateTurn, isTurnPassing } from './evaluator';
import type { TestCase, TestResult, TurnResult, ToolCallCapture } from './types';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 4096;
const MAX_LOOP_ITERATIONS = 10;

function generateTimeSeriesData(days: number): Record<string, unknown>[] {
  const data: Record<string, unknown>[] = [];
  const baseValue = 4100;
  for (let i = days; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      time: date.toISOString().split('T')[0],
      fecha: date.toISOString().split('T')[0],
      day: date.toISOString().split('T')[0],
      value: Math.round((baseValue + Math.random() * 200 - 100) * 100) / 100,
      close: Math.round((baseValue + Math.random() * 200 - 100) * 100) / 100,
      valor: Math.round((baseValue + Math.random() * 200 - 100) * 100) / 100,
      volume: Math.round(Math.random() * 1000000),
    });
  }
  return data;
}

function makeSyntheticToolResult(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'query_database': {
      const sql = ((toolInput.sql as string) || '').toLowerCase();
      // If it looks like a time series query, return multiple rows
      if (sql.includes('order by') || sql.includes('between') || sql.includes('month') || sql.includes('>=') || sql.includes('interval')) {
        return JSON.stringify({ rows: generateTimeSeriesData(30), rowCount: 31 });
      }
      // If it asks for a curve (multiple tenors)
      if (sql.includes('ibr_quotes_curve') || sql.includes('ust_yield') || sql.includes('tes_operation')) {
        return JSON.stringify({
          rows: [
            { tenor: '1M', yield: 9.25, fecha: '2026-04-17' },
            { tenor: '3M', yield: 9.30, fecha: '2026-04-17' },
            { tenor: '6M', yield: 9.35, fecha: '2026-04-17' },
            { tenor: '1Y', yield: 9.40, fecha: '2026-04-17' },
            { tenor: '2Y', yield: 9.50, fecha: '2026-04-17' },
            { tenor: '5Y', yield: 9.80, fecha: '2026-04-17' },
            { tenor: '10Y', yield: 10.20, fecha: '2026-04-17' },
          ],
          rowCount: 7,
        });
      }
      // If it asks for count
      if (sql.includes('count')) {
        return JSON.stringify({ rows: [{ count: 5 }], rowCount: 1 });
      }
      // If it asks for politica_monetaria
      if (sql.includes('politica_monetaria')) {
        return JSON.stringify({ rows: generateTimeSeriesData(30).map((d) => ({ ...d, tasa: 9.5 + Math.random() * 0.5 })), rowCount: 31 });
      }
      // Default: single latest value
      return JSON.stringify({
        rows: [{ value: 4150.25, time: '2026-04-17T00:00:00' }],
        rowCount: 1,
      });
    }
    case 'generate_chart':
      return JSON.stringify({ success: true, message: 'Chart rendered successfully' });
    case 'navigate_to':
      return JSON.stringify({ success: true, message: 'Navigation executed' });
    case 'create_position':
      return JSON.stringify({
        success: true,
        data: { id: 'test-00000000-0000-0000-0000-000000000001', message: 'Posicion creada (dry-run)' },
      });
    case 'create_loan':
      return JSON.stringify({
        success: true,
        data: { message: 'Prestamo creado (dry-run)' },
      });
    default:
      return JSON.stringify({ success: true });
  }
}

async function executeTurn(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  verbose: boolean,
): Promise<{ toolCalls: ToolCallCapture[]; assistantText: string; tokenUsage: { input: number; output: number } }> {
  const allToolCalls: ToolCallCapture[] = [];
  let assistantText = '';
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools,
      messages,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`  [loop ${i}] stop_reason=${response.stop_reason}, blocks=${response.content.length}`);
    }

    // Extract text
    for (const block of response.content) {
      if (block.type === 'text') {
        assistantText += block.text;
      }
    }

    if (response.stop_reason === 'end_turn') {
      // Add the final assistant message to context for multi-turn continuity
      messages.push({ role: 'assistant', content: response.content });
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      for (const tb of toolBlocks) {
        allToolCalls.push({
          tool: tb.name,
          input: tb.input as Record<string, unknown>,
        });

        if (verbose) {
          // eslint-disable-next-line no-console
          console.log(`  [tool] ${tb.name}(${JSON.stringify(tb.input).slice(0, 200)}...)`);
        }
      }

      // Add assistant response with tool_use blocks to messages
      messages.push({ role: 'assistant', content: response.content });

      // Generate synthetic tool results
      const toolResults: Anthropic.ToolResultBlockParam[] = toolBlocks.map((tb) => ({
        type: 'tool_result' as const,
        tool_use_id: tb.id,
        content: makeSyntheticToolResult(tb.name, tb.input as Record<string, unknown>),
      }));

      messages.push({ role: 'user', content: toolResults });
    } else {
      // Any other stop reason — still add to context
      messages.push({ role: 'assistant', content: response.content });
      break;
    }
  }

  return { toolCalls: allToolCalls, assistantText, tokenUsage: { input: totalInput, output: totalOutput } };
}

export async function runTestCase(
  client: Anthropic,
  testCase: TestCase,
  verbose: boolean = false,
): Promise<TestResult> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt('Test User');
  const messages: Anthropic.MessageParam[] = [];
  const turnResults: TurnResult[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  try {
    for (let turnIdx = 0; turnIdx < testCase.turns.length; turnIdx += 1) {
      const turn = testCase.turns[turnIdx];
      const turnStart = Date.now();

      if (verbose) {
        // eslint-disable-next-line no-console
        console.log(`\n  Turn ${turnIdx}: "${turn.userMessage.slice(0, 80)}..."`);
      }

      // Add user message — executeTurn will manage messages from here
      messages.push({ role: 'user', content: turn.userMessage });

      // Execute turn (this mutates messages for context continuity)
      // eslint-disable-next-line no-await-in-loop
      const { toolCalls, assistantText, tokenUsage } = await executeTurn(
        client, messages, systemPrompt, verbose,
      );

      totalInput += tokenUsage.input;
      totalOutput += tokenUsage.output;

      // Build turn result
      const turnResult: TurnResult = {
        turnIndex: turnIdx,
        userMessage: turn.userMessage,
        toolCalls,
        assistantText,
        toolValidations: [],
        durationMs: Date.now() - turnStart,
      };

      // Evaluate
      const { toolValidations, textValidation } = evaluateTurn(turn, turnResult);
      turnResult.toolValidations = toolValidations;
      turnResult.textValidation = textValidation;

      turnResults.push(turnResult);
    }

    const allPassed = turnResults.every((tr) =>
      isTurnPassing(tr.toolValidations, tr.textValidation),
    );

    return {
      testCase,
      passed: allPassed,
      turns: turnResults,
      totalDurationMs: Date.now() - startTime,
      tokenUsage: { input: totalInput, output: totalOutput },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return {
      testCase,
      passed: false,
      turns: turnResults,
      totalDurationMs: Date.now() - startTime,
      error: msg,
      tokenUsage: { input: totalInput, output: totalOutput },
    };
  }
}
