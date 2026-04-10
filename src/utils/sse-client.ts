import type { SSEEvent } from 'src/types/chat';

function parseSseLine(line: string): SSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return null;

  const jsonStr = trimmed.slice(6);
  try {
    return JSON.parse(jsonStr) as SSEEvent;
  } catch {
    return null;
  }
}

function processBuffer(buffer: string, onEvent: (event: SSEEvent) => void): string {
  const lines = buffer.split('\n');
  const remaining = lines.pop() || '';

  lines.forEach((line) => {
    const event = parseSseLine(line);
    if (event) onEvent(event);
  });

  return remaining;
}

// eslint-disable-next-line import/prefer-default-export
export async function streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    const msg = err instanceof Error ? err.message : 'Error de conexion';
    onEvent({ type: 'error', error: msg });
    return;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    onEvent({
      type: 'error',
      error: (errorBody as Record<string, string>).error || `Error ${response.status}`,
    });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onEvent({ type: 'error', error: 'No se pudo leer la respuesta' });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  while (!done) {
    // eslint-disable-next-line no-await-in-loop
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: true });
      buffer = processBuffer(buffer, onEvent);
    }
  }

  const finalEvent = parseSseLine(buffer);
  if (finalEvent) onEvent(finalEvent);
}
