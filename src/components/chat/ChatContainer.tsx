import React from 'react';
import useAppStore from 'src/store';
import ChatBubble from './ChatBubble';
import ChatPanel from './ChatPanel';

export default function ChatContainer() {
  const { chatOpen } = useAppStore();

  return (
    <>
      <ChatBubble />
      {chatOpen && <ChatPanel />}
    </>
  );
}
