import React from 'react';
import styled, { keyframes } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faTimes } from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';

const pulse = keyframes`
  0% { box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3); }
  50% { box-shadow: 0 4px 20px rgba(79, 70, 229, 0.5); }
  100% { box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3); }
`;

const BubbleButton = styled.button<{ $isOpen: boolean }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: #4F46E5;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  z-index: 1050;
  transition: transform 0.2s ease, background 0.2s ease;
  animation: ${pulse} 3s ease-in-out infinite;

  &:hover {
    transform: scale(1.08);
    background: #4338ca;
  }

  ${(p) => p.$isOpen && `
    animation: none;
    background: #64748b;
    &:hover { background: #475569; }
  `}
`;

export default function ChatBubble() {
  const { chatOpen, toggleChat } = useAppStore();

  return (
    <BubbleButton
      $isOpen={chatOpen}
      onClick={toggleChat}
      title={chatOpen ? 'Cerrar chat' : 'Abrir asistente Xerenity'}
    >
      <FontAwesomeIcon icon={chatOpen ? faTimes : faRobot} />
    </BubbleButton>
  );
}
