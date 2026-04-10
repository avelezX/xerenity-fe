import React from 'react';
import styled from 'styled-components';
import type { ChatMessage as ChatMessageType } from 'src/types/chat';
import ChatChart from './ChatChart';

const MessageWrapper = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${(p) => (p.$isUser ? 'flex-end' : 'flex-start')};
  margin-bottom: 12px;
  padding: 0 8px;
`;

const Bubble = styled.div<{ $isUser: boolean }>`
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  ${(p) =>
    p.$isUser
      ? `
    background: #4F46E5;
    color: white;
    border-bottom-right-radius: 4px;
  `
      : `
    background: #f1f5f9;
    color: #1e293b;
    border-bottom-left-radius: 4px;
  `}
`;

const ToolBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin: 4px 0;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
`;

const NavLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  margin-top: 8px;
  background: #4F46E5;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background: #4338ca;
  }
`;

const TOOL_LABELS: Record<string, string> = {
  query_database: 'Consultando base de datos...',
  generate_chart: 'Generando grafico...',
  navigate_to: 'Navegando...',
  create_position: 'Creando posicion...',
  create_loan: 'Creando prestamo...',
};

interface Props {
  message: ChatMessageType;
  onNavigate?: (path: string) => void;
}

export default function ChatMessageComponent({ message, onNavigate }: Props) {
  const isUser = message.role === 'user';

  return (
    <MessageWrapper $isUser={isUser}>
      <Bubble $isUser={isUser}>
        {/* Tool call indicators */}
        {!isUser && message.toolCalls?.map((tc) => (
          <ToolBadge key={tc.id}>
            {tc.status === 'pending' ? '⏳' : '✓'}{' '}
            {TOOL_LABELS[tc.tool] || tc.tool}
          </ToolBadge>
        ))}

        {/* Message text */}
        {message.content}

        {/* Inline charts */}
        {!isUser && message.charts?.map((chart, i) => (
          <ChatChart key={`chart-${i}`} spec={chart} />
        ))}

        {/* Navigation link */}
        {!isUser && message.navigationTarget && onNavigate && (
          <NavLink onClick={() => onNavigate(message.navigationTarget!)}>
            Ir a {message.navigationTarget}
          </NavLink>
        )}
      </Bubble>
    </MessageWrapper>
  );
}
