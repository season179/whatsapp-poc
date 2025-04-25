import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode.react';

// Connect to backend Socket.io server
const socket = io('http://localhost:3001');

const App: React.FC = () => {
  const [status, setStatus] = useState<string>('Disconnected');
  const [qr, setQr] = useState<string>('');

  useEffect(() => {
    socket.on('connect', () => setStatus('Connected'));
    socket.on('disconnect', () => setStatus('Disconnected'));
    socket.on('qr', (qrCode: string) => setQr(qrCode));
    socket.on('chats', (list: any[]) => console.log('Chats:', list));
    socket.on('message', (msg: any) => console.log('Message:', msg));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('qr');
      socket.off('chats');
      socket.off('message');
    };
  }, []);

  const sendTestMessage = () => {
    socket.emit('sendMessage', { chatId: 'your-chat-id', content: 'Hello from frontend' });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>WhatsApp Bot Frontend</h1>
      <p>Status: {status}</p>
      {qr && (
        <div>
          <h2>Scan the QR Code</h2>
          <QRCode value={qr} size={256} />
        </div>
      )}
      <button onClick={sendTestMessage}>Send Test Message</button>
    </div>
  );
};

export default App;
