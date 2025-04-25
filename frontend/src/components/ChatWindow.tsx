import React, { useRef, useEffect } from 'react';

export interface Message {
  id: string;
  fromMe: boolean;
  content: string;
  timestamp: string;
}

interface ChatWindowProps {
  messages: Message[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ flex: 1, padding: 20, overflowY: 'auto', height: '100vh' }}>
      {messages.map(msg => (
        <div key={msg.id} style={{ marginBottom: 10, textAlign: msg.fromMe ? 'right' : 'left' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: msg.fromMe ? '#dcf8c6' : '#fff',
              border: '1px solid #ccc'
            }}
          >
            {msg.content}
          </div>
          <div style={{ fontSize: '10px', color: '#999', marginTop: 2 }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatWindow;
