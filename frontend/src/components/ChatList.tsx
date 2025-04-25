import React from 'react';

export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  unreadCount?: number;
}

interface ChatListProps {
  chats: Chat[];
  selectedChat: string | null;
  onSelect: (chatId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, selectedChat, onSelect }) => (
  <div style={{ width: 300, borderRight: '1px solid #ccc', overflowY: 'auto', height: '100vh' }}>
    {chats.map(chat => (
      <div
        key={chat.id}
        onClick={() => onSelect(chat.id)}
        style={{
          padding: '10px',
          cursor: 'pointer',
          backgroundColor: chat.id === selectedChat ? '#e6e6e6' : 'transparent'
        }}
      >
        <div><strong>{chat.name}</strong></div>
        {chat.lastMessage && <div style={{ fontSize: '12px', color: '#555' }}>{chat.lastMessage}</div>}
        {chat.unreadCount && chat.unreadCount > 0 && (
          <div style={{ fontSize: '12px', color: 'red' }}>{chat.unreadCount} new</div>
        )}
      </div>
    ))}
  </div>
);

export default ChatList;
