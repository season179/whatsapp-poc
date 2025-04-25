import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import QRScanner from './components/QRScanner';
import ChatList, { Chat } from './components/ChatList';
import ChatWindow, { Message } from './components/ChatWindow';

// Connect to backend Socket.io server
const socket = io('http://localhost:3001');

const App: React.FC = () => {
  const [status, setStatus] = useState<string>('Disconnected');
  const [qr, setQr] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    socket.on('connect', () => setStatus('Socket Connected')); 
    socket.on('disconnect', () => {
        setStatus('Disconnected');
        setQr(''); 
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
    });
    socket.on('qr', (qrCode: string) => {
        setStatus('QR Code Received');
        setQr(qrCode);
    });
    socket.on('ready', () => {
        setStatus('WhatsApp Ready');
        setQr(''); 
    });
    socket.on('chats', (list: Chat[]) => setChats(list));
    socket.on('message', (msg: any) => {
      const incoming: Message = { id: msg.id?.toString() || `msg_${Date.now()}`, fromMe: msg.fromMe, content: msg.body || msg.content || 'Unsupported message', timestamp: msg.timestamp }; 
      setChats(prev => prev.map(c => c.id === msg.chatId ? { ...c, lastMessage: incoming.content } : c)); 
      if (selectedRef.current === msg.chatId) {
        setMessages(prev => [...prev, incoming]);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('qr');
      socket.off('ready'); 
      socket.off('chats');
      socket.off('message');
    };
  }, []);

  useEffect(() => { selectedRef.current = selectedChat; }, [selectedChat]);

  useEffect(() => {
    if (selectedChat) {
      fetch(`http://localhost:3001/api/messages/${selectedChat}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then((msgs: any[]) => {
            setMessages(msgs.map(m => ({ id: m.id?.toString() || `msg_${Date.now()}`, fromMe: m.fromMe, content: m.body || m.content || 'Unsupported message', timestamp: m.timestamp }))); 
        })
        .catch(error => {
            console.error("Failed to fetch messages:", error);
            setMessages([]); 
        });
    } else {
        setMessages([]); 
    }
  }, [selectedChat]);

  const sendMessage = () => {
    if (selectedChat && input.trim()) {
      const tempId = `temp_${Date.now()}`; 
      socket.emit('sendMessage', { chatId: selectedChat, content: input });
      setMessages(prev => [...prev, { id: tempId, fromMe: true, content: input, timestamp: new Date().toISOString() }]);
      setInput('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedChat) return;
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
       const tempId = `temp_media_${Date.now()}`;
      socket.emit('sendMedia', { chatId: selectedChat, media: { mimetype: file.type, data: base64, filename: file.name } });
      setMessages(prev => [...prev, { id: tempId, fromMe: true, content: `Sending ${file.name}...`, timestamp: new Date().toISOString() }]); 
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

   return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ChatList chats={chats} selectedChat={selectedChat} onSelect={id => setSelectedChat(id)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ccc' }}>
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#f7f7f7' }}>
          <h1>WhatsApp Bot</h1>
          <p>Status: {status}</p>
        </div>

        {/* --- Updated Conditional Rendering Logic --- */}
        
        {/* Show QR Scanner */}
        {status === 'QR Code Received' && qr && <QRScanner qr={qr} />}
        
        {/* Show message when ready but no chat is selected */}
        {status === 'WhatsApp Ready' && !selectedChat && chats.length > 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
              Select a chat to start messaging.
            </div>
         )}
 
        {/* Show Chat Window and Input */}
         {status === 'WhatsApp Ready' && selectedChat ? (
            <>
              <ChatWindow messages={messages} />
              <div style={{ display: 'flex', padding: 10, borderTop: '1px solid #eee', background: '#f0f0f0' }}>
                {/* Input, Send Button, Attach Label */}
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  style={{ flex: 1, marginRight: 10, padding: '8px 12px', borderRadius: '20px', border: '1px solid #ccc' }}
                />
                <button onClick={sendMessage} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer' }}>Send</button>
                <label style={{ marginLeft: 10, padding: '8px 15px', borderRadius: '20px', border: '1px solid #ccc', background: '#ddd', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  Attach
                  <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </> 
         ) : null } {/* Only show chat window when ready AND chat selected */}
         
         {/* Show status messages for intermediate/loading states */}
         {status === 'Socket Connected' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
              Waiting for QR code or WhatsApp connection...
            </div>
         )}
         {status === 'WhatsApp Ready' && chats.length === 0 && !selectedChat && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                Fetching chats...
              </div>
          )}
 
          {status === 'Disconnected' && (
               <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}>
                Disconnected. Attempting to reconnect...
               </div>
          )}
 
       </div>
     </div>
   );
};

export default App;
