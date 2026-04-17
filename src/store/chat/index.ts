import { StateCreator } from 'zustand';
import type { ChatMessage, ChartSpec, SSEEvent } from 'src/types/chat';
import { streamChat } from 'src/utils/sse-client';

export interface ChatSlice {
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  chatLoading: boolean;
  chatError: string | undefined;
  chatAbortController: AbortController | undefined;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  stopGeneration: () => void;
}

const initialState = {
  chatMessages: [],
  chatOpen: false,
  chatLoading: false,
  chatError: undefined,
  chatAbortController: undefined,
};

const createChatSlice: StateCreator<ChatSlice> = (set, get) => ({
  ...initialState,

  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),

  clearChat: () => set({ chatMessages: [], chatError: undefined }),

  stopGeneration: () => {
    const controller = get().chatAbortController;
    if (controller) controller.abort();
    set({ chatLoading: false, chatAbortController: undefined });
  },

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: [],
      charts: [],
    };

    set((s) => ({
      chatMessages: [...s.chatMessages, userMessage, assistantMessage],
      chatLoading: true,
      chatError: undefined,
    }));

    const abortController = new AbortController();
    set({ chatAbortController: abortController });

    // Build messages array with chart context injected in the first user message
    const state = get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storeAny = state as any;
    const chartInfo = storeAny.chartSelections?.length > 0
      ? `[CONTEXTO DEL GRAFICO ACTUAL: Series cargadas: ${storeAny.chartSelections.map((s: { display_name: string }) => s.display_name).join(', ')}. Periodo: ${storeAny.chartPeriod || '1Y'}. El usuario puede ver estas series en pantalla.]`
      : '';

    const apiMessages = state.chatMessages.map((m, idx) => ({
      role: m.role,
      content: idx === 0 && m.role === 'user' && chartInfo
        ? `${chartInfo}\n\n${m.content}`
        : m.content,
    }));

    const assistantId = assistantMessage.id;

    const updateAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
      set((s) => ({
        chatMessages: s.chatMessages.map((m) =>
          m.id === assistantId ? updater(m) : m
        ),
      }));
    };

    try {
      await streamChat(
        apiMessages,
        (event: SSEEvent) => {
          switch (event.type) {
            case 'text_delta':
              updateAssistant((m) => ({
                ...m,
                content: m.content + (event.text || ''),
              }));
              break;

            case 'tool_use':
              updateAssistant((m) => ({
                ...m,
                toolCalls: [
                  ...(m.toolCalls || []),
                  {
                    id: event.toolCallId || '',
                    tool: event.tool || '',
                    input: event.input || {},
                    status: 'pending' as const,
                  },
                ],
              }));
              break;

            case 'tool_result':
              // Update tool call status
              updateAssistant((m) => ({
                ...m,
                toolCalls: (m.toolCalls || []).map((tc) =>
                  tc.id === event.toolCallId
                    ? { ...tc, result: event.result, status: 'success' as const }
                    : tc
                ),
                // Add chart data if present
                charts: event.chartData
                  ? [...(m.charts || []), event.chartData as ChartSpec]
                  : m.charts,
                // Store navigation target
                navigationTarget: event.navigationTarget || m.navigationTarget,
                // Store series action for in-page chart loading
                seriesAction: event.seriesData
                  ? {
                    tickers: event.seriesData.tickers as string[],
                    names: (event.seriesData.names as string[]) || event.seriesData.tickers as string[],
                    description: event.seriesData.description as string,
                  }
                  : m.seriesAction,
                // Store chart control action
                chartControlAction: event.chartAction || m.chartControlAction,
              }));
              break;

            case 'error':
              set({ chatError: event.error });
              break;

            case 'done':
              break;

            default:
              break;
          }
        },
        abortController.signal
      );
    } catch {
      // Error already handled via SSE event
    } finally {
      set({ chatLoading: false, chatAbortController: undefined });
    }
  },
});

export default createChatSlice;
