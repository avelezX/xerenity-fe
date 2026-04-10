import Anthropic from '@anthropic-ai/sdk';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildSystemPrompt } from './system-prompt';
import { tools } from './tools';
import { executeTool } from './tool-executor';
import { checkRateLimit } from './rate-limiter';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

function sendSSE(res: NextApiResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate session
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  // Rate limit
  const { allowed, retryAfterMs } = checkRateLimit(session.user.id);
  if (!allowed) {
    res.status(429).json({ error: 'Limite de mensajes excedido', retryAfterMs });
    return;
  }

  const { messages: clientMessages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
    res.status(400).json({ error: 'Messages requeridos' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userName = session.user.user_metadata?.full_name || session.user.email;
  const systemPrompt = buildSystemPrompt(userName);

  // Build Anthropic messages from client messages
  const anthropicMessages: Anthropic.MessageParam[] = clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Agentic loop: keep calling Anthropic until end_turn
    let loopCount = 0;
    const MAX_LOOPS = 10;

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: anthropicMessages,
      });

      // Stream text deltas to client
      stream.on('text', (delta) => {
        sendSSE(res, { type: 'text_delta', text: delta });
      });

      const message = await stream.finalMessage();

      if (message.stop_reason === 'end_turn') {
        sendSSE(res, { type: 'done' });
        break;
      }

      if (message.stop_reason === 'tool_use') {
        // Extract tool_use blocks
        const toolUseBlocks = message.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        // Append assistant response (with tool_use blocks) to messages
        anthropicMessages.push({ role: 'assistant', content: message.content });

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolBlock of toolUseBlocks) {
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

          // If chart data, send it to the client
          if (result.chartData) {
            sendSSE(res, {
              type: 'tool_result',
              tool: toolBlock.name,
              toolCallId: toolBlock.id,
              chartData: result.chartData,
            });
          }

          // If navigation target, send it
          if (result.navigationTarget) {
            sendSSE(res, {
              type: 'tool_result',
              tool: toolBlock.name,
              toolCallId: toolBlock.id,
              navigationTarget: result.navigationTarget,
            });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result.success ? result.data ?? result : { error: result.error }),
            is_error: !result.success,
          });
        }

        // Append tool results to messages
        anthropicMessages.push({ role: 'user', content: toolResults });

        // Continue the loop — Anthropic will process tool results
        continue;
      }

      // Any other stop reason, end
      sendSSE(res, { type: 'done' });
      break;
    }

    if (loopCount >= MAX_LOOPS) {
      sendSSE(res, {
        type: 'error',
        error: 'Se alcanzo el limite maximo de iteraciones del agente.',
      });
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      sendSSE(res, { type: 'error', error: 'Limite de API de Anthropic alcanzado. Intenta de nuevo en unos minutos.' });
    } else if (error instanceof Anthropic.APIError) {
      sendSSE(res, { type: 'error', error: `Error de API: ${error.message}` });
    } else {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      sendSSE(res, { type: 'error', error: message });
    }
  } finally {
    res.end();
  }
}
