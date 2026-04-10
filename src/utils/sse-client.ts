import type { SSEEvent } from 'src/types/chat';

export function streamChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        onEvent({
          type: 'error',
          error: errorBody.error || `Error ${response.status}`,
        });
        resolve();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onEvent({ type: 'error', error: 'No se pudo leer la respuesta' });
        resolve();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr) as SSEEvent;
            onEvent(event);
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6);
        try {
          const event = JSON.parse(jsonStr) as SSEEvent;
          onEvent(event);
        } catch {
          // Ignore
        }
      }

      resolve();
    } catch (err) {
      if (signal?.aborted) {
        resolve();
        return;
      }
      const message = err instanceof Error ? err.message : 'Error de conexion';
      onEvent({ type: 'error', error: message });
      reject(err);
    }
  });
}
