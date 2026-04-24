import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faTimes, faTrash, faStop } from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';
import { useRouter } from 'next/router';
import ChatMessageComponent from './ChatMessage';

const PanelOverlay = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 100vw;
  background: white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  z-index: 1049;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease-out;

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 16px;
  color: #1e293b;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 14px;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 15px;
  text-align: center;
  padding: 24px;
  gap: 8px;
`;

const InputArea = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Input = styled.input`
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  &:focus { border-color: #4F46E5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1); }
`;

const SendBtn = styled.button<{ $loading?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: ${(p) => (p.$loading ? '#94a3b8' : '#4F46E5')};
  color: white;
  cursor: ${(p) => (p.$loading ? 'not-allowed' : 'pointer')};
  font-size: 14px;
  &:hover:not(:disabled) { background: ${(p) => (p.$loading ? '#94a3b8' : '#4338ca')}; }
`;

const ErrorBanner = styled.div`
  padding: 8px 16px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 14px;
  border-bottom: 1px solid #fecaca;
`;

const SuggestionsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const SuggestionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  &:hover {
    background: #f0f0ff;
    border-color: #4F46E5;
    color: #4F46E5;
  }
`;

const ChartContext = styled.div`
  padding: 8px 16px;
  background: #f0fdf4;
  color: #166534;
  font-size: 12px;
  border-bottom: 1px solid #bbf7d0;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export default function ChatPanel() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');

  const {
    chatMessages,
    chatLoading,
    chatError,
    closeChat,
    sendMessage,
    clearChat,
    stopGeneration,
    addTickerToChart,
    chartSelections,
    chartPeriod,
    setChartPeriod,
    setNormalizeChart,
    clearChart,
    removeFromChart,
  } = useAppStore();

  const lastNavTarget = useRef<string | null>(null);
  const lastSeriesAction = useRef<string | null>(null);
  const lastChartAction = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-navigate when agent sets a navigationTarget (for navigate_to tool)
  useEffect(() => {
    if (chatLoading) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg?.navigationTarget && lastMsg.navigationTarget !== lastNavTarget.current) {
      lastNavTarget.current = lastMsg.navigationTarget;
      router.push(lastMsg.navigationTarget);
    }
  }, [chatMessages, chatLoading, router]);

  // Auto-load series into current chart when agent calls view_series
  useEffect(() => {
    if (chatLoading) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg?.seriesAction) return;

    const actionKey = lastMsg.seriesAction.tickers.join(',');
    if (actionKey === lastSeriesAction.current) return;
    lastSeriesAction.current = actionKey;

    // Navigate to SUAMECA if not already there, then load series
    const isSuamecaPage = router.pathname === '/suameca';
    if (!isSuamecaPage) {
      router.push('/suameca');
    }

    // Load each ticker into the chart with its display name
    lastMsg.seriesAction.tickers.forEach((ticker, idx) => {
      const displayName = lastMsg.seriesAction?.names?.[idx] || ticker;
      addTickerToChart(ticker, displayName);
    });
  }, [chatMessages, chatLoading, router, addTickerToChart]);

  // Execute chart control actions (period, normalize, clear, remove)
  useEffect(() => {
    if (chatLoading) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg?.chartControlAction) return;

    const actionKey = JSON.stringify(lastMsg.chartControlAction);
    if (actionKey === lastChartAction.current) return;
    lastChartAction.current = actionKey;

    const { action, period, normalize, ticker } = lastMsg.chartControlAction;

    switch (action) {
      case 'set_period':
        if (period) setChartPeriod(period as Parameters<typeof setChartPeriod>[0]);
        break;
      case 'normalize':
        setNormalizeChart(normalize !== false);
        break;
      case 'clear':
        clearChart();
        break;
      case 'remove_series':
        if (ticker) removeFromChart(ticker);
        break;
      default:
        break;
    }
  }, [chatMessages, chatLoading, setChartPeriod, setNormalizeChart, clearChart, removeFromChart]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch suggestions from DB (super_admin can edit these via /admin/agent)
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; icon: string; title: string; prompt: string }>
  >([]);
  useEffect(() => {
    fetch('/api/chat/suggestions')
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => setSuggestions([]));
  }, []);

  // Build chart context string for the agent
  const chartContextText = chartSelections.length > 0
    ? `${chartSelections.map((s) => s.display_name).join(', ')} | Periodo: ${chartPeriod}`
    : null;

  const handleSuggestion = (text: string) => {
    if (chatLoading) return;
    sendMessage(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatLoading) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    closeChat();
  };

  return (
    <PanelOverlay>
      <Header>
        <Title>Xerenity AI</Title>
        <HeaderActions>
          <IconBtn onClick={clearChat} title="Limpiar chat">
            <FontAwesomeIcon icon={faTrash} />
          </IconBtn>
          <IconBtn onClick={closeChat} title="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </IconBtn>
        </HeaderActions>
      </Header>

      {chatError && <ErrorBanner>{chatError}</ErrorBanner>}
      {chartContextText && (
        <ChartContext>
          📊 En grafico: {chartContextText}
        </ChartContext>
      )}

      <MessagesArea>
        {chatMessages.length === 0 ? (
          <EmptyState>
            <div style={{ fontSize: 28 }}>🤖</div>
            <div>Soy el asistente de Xerenity</div>
            <div style={{ fontSize: 13, color: '#b0b8c4' }}>
              Puedo consultar datos, graficar series y crear posiciones.
            </div>
            {suggestions.length > 0 && (
              <SuggestionsGrid>
                {suggestions.map((s) => (
                  <SuggestionBtn key={s.id} onClick={() => handleSuggestion(s.prompt)}>
                    <span>{s.icon}</span>
                    <span>{s.title}</span>
                  </SuggestionBtn>
                ))}
              </SuggestionsGrid>
            )}
          </EmptyState>
        ) : (
          chatMessages.map((msg) => (
            <ChatMessageComponent
              key={msg.id}
              message={msg}
              onNavigate={handleNavigate}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </MessagesArea>

      <InputArea onSubmit={handleSubmit}>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Preguntame algo..."
          disabled={chatLoading}
        />
        {chatLoading ? (
          <SendBtn type="button" $loading onClick={stopGeneration} title="Detener">
            <FontAwesomeIcon icon={faStop} />
          </SendBtn>
        ) : (
          <SendBtn type="submit" title="Enviar">
            <FontAwesomeIcon icon={faPaperPlane} />
          </SendBtn>
        )}
      </InputArea>
    </PanelOverlay>
  );
}
