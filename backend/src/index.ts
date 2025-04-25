import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeWhatsAppClient, getClient } from './whatsapp';
import { prisma } from './db'; // Ensure prisma client is imported

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // Allow all origins for now (adjust for production!)
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(express.json());

// Simple root endpoint
app.get('/', (req, res) => {
  res.send('WhatsApp Bot Backend is running!');
});

// Initialize WhatsApp client and pass io instance
initializeWhatsAppClient(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Example: Handle message sending from frontend
  socket.on(
    'sendMessage',
    async (data: { chatId: string; message: string }) => {
      console.log('sendMessage event received:', data);
      try {
        const client = getClient();
        const msg = await client.sendMessage(data.chatId, data.message);
        console.log('Message sent:', msg.id._serialized);
        // TODO: Persist sent message
        // TODO: Emit confirmation/update back to frontend?
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('send_message_error', {
          chatId: data.chatId,
          error: 'Failed to send message',
        });
      }
    }
  );

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// TODO: Add REST API endpoints (/api/chats, /api/messages/:chatId)

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try {
    const client = getClient();
    await client.destroy(); // Cleanly close WhatsApp connection
  } catch (error) {
    console.error('Error destroying WhatsApp client:', error);
  }
  await prisma.$disconnect(); // Disconnect Prisma client
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
