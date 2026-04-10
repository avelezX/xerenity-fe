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

    // Build simple messages array for the API
    const apiMessages = get().chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
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
              }));
              break;

            case 'error':
              set({ chatError: event.error });
              break;

            case 'done':
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
