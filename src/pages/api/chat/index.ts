import Anthropic from '@anthropic-ai/sdk';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildSystemPrompt } from './system-prompt';
import { tools } from './tools';
import { executeTool } from './tool-executor';
import { checkRateLimit } from './rate-limiter';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
  // Vercel Pro caps node-runtime API routes at 60s by default. Debugging
  // sessions can take longer once the agent chains 5–10 tool calls
  // (query_database + read_repo_file roundtrips). 300s is the Pro maximum.
  maxDuration: 300,
};

function sendSSE(res: NextApiResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function executeToolCalls(
  toolUseBlocks: Anthropic.ToolUseBlock[],
  res: NextApiResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
    toolUseBlocks.map(async (toolBlock) => {
      sendSSE(res, {
        type: 'tool_use',
        tool: toolBlock.name,
        toolCallId: toolBlock.id,
        input: toolBlock.input,
      });

      const result = await executeTool(
        toolBlock.name,
        toolBlock.input as Record<string, unknown>,
        supabase,
      );

      if (result.chartData) {
        sendSSE(res, {
          type: 'tool_result',
          tool: toolBlock.name,
          toolCallId: toolBlock.id,
          chartData: result.chartData,
        });
      }

      if (result.navigationTarget) {
        // view_series returns tickers in data — send as seriesData for in-page loading
        const resultData = result.data as Record<string, unknown> | undefined;
        if (toolBlock.name === 'view_series' && resultData?.tickers) {
          sendSSE(res, {
            type: 'tool_result',
            tool: toolBlock.name,
            toolCallId: toolBlock.id,
            seriesData: {
              tickers: resultData.tickers,
              names: resultData.names,
              description: resultData.description || '',
            },
          });
        } else {
          sendSSE(res, {
            type: 'tool_result',
            tool: toolBlock.name,
            toolCallId: toolBlock.id,
            navigationTarget: result.navigationTarget,
          });
        }
      }

      if (result.chartAction) {
        sendSSE(res, {
          type: 'tool_result',
          tool: toolBlock.name,
          toolCallId: toolBlock.id,
          chartAction: result.chartAction,
        });
      }

      // Emit a tool_result on failure too, so the client can resolve the
      // pending toolCall to an error state instead of leaving it spinning.
      if (!result.success) {
        sendSSE(res, {
          type: 'tool_result',
          tool: toolBlock.name,
          toolCallId: toolBlock.id,
          is_error: true,
          error: result.error ?? 'Error en la herramienta',
        });
      }

      return {
        type: 'tool_result' as const,
        tool_use_id: toolBlock.id,
        content: JSON.stringify(result.success ? result.data ?? result : { error: result.error }),
        is_error: !result.success,
      };
    }),
  );

  return results;
}

// eslint-disable-next-line consistent-return
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { allowed, retryAfterMs } = checkRateLimit(session.user.id);
  if (!allowed) {
    return res.status(429).json({ error: 'Limite de mensajes excedido', retryAfterMs });
  }

  const { messages: clientMessages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
    return res.status(400).json({ error: 'Messages requeridos' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userName = session.user.user_metadata?.full_name || session.user.email;
  const systemPrompt = await buildSystemPrompt(userName, supabase);

  const anthropicMessages: Anthropic.MessageParam[] = clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Generous loop budget for diagnose-an-alert sessions which often need
    // catalog query + multiple file reads + a follow-up query. Bumped from
    // 10 after the agent ran out mid-debugging on a stale-table alert.
    const MAX_LOOPS = 20;
    let hitLimit = true;

    for (let loopCount = 0; loopCount < MAX_LOOPS; loopCount += 1) {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        // cache_control on the system block caches the system prompt AND the
        // tools array (tools precede system in the prompt-cache order), so the
        // large static prefix is billed once and reused across the up-to-20
        // tool-use loop iterations of a single request (and across turns in a
        // conversation within the 5-min TTL).
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: anthropicMessages,
      });

      stream.on('text', (delta) => {
        sendSSE(res, { type: 'text_delta', text: delta });
      });

      // eslint-disable-next-line no-await-in-loop
      const message = await stream.finalMessage();

      if (message.stop_reason === 'end_turn') {
        sendSSE(res, { type: 'done' });
        hitLimit = false;
        break;
      }

      if (message.stop_reason === 'tool_use') {
        const toolUseBlocks = message.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        anthropicMessages.push({ role: 'assistant', content: message.content });

        // eslint-disable-next-line no-await-in-loop
        const toolResults = await executeToolCalls(toolUseBlocks, res, supabase);

        anthropicMessages.push({ role: 'user', content: toolResults });
      } else {
        sendSSE(res, { type: 'done' });
        hitLimit = false;
        break;
      }
    }

    // If the loop exits because we hit MAX_LOOPS (not a clean stop_reason),
    // still tell the client we're done so the spinner clears. Without this
    // the UI keeps "thinking" forever and the user has to reload.
    if (hitLimit) {
      sendSSE(res, {
        type: 'text_delta',
        text: '\n\n_(El agente alcanzó el límite de iteraciones. Si necesitás que siga investigando, escribí "continuá" o pedile algo más específico.)_',
      });
      sendSSE(res, { type: 'done' });
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      sendSSE(res, { type: 'error', error: 'Limite de API de Anthropic alcanzado. Intenta de nuevo en unos minutos.' });
    } else if (error instanceof Anthropic.APIError) {
      sendSSE(res, { type: 'error', error: `Error de API: ${error.message}` });
    } else {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      sendSSE(res, { type: 'error', error: msg });
    }
  } finally {
    res.end();
  }
}
