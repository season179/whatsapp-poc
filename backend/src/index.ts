import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeWhatsAppClient, getClient } from './whatsapp';
import { prisma } from './db'; // Ensure prisma client is imported
import { Message as WAMessage, Chat as WAChat } from 'whatsapp-web.js'; // Import message type
import { Prisma } from '@prisma/client'; // Import Prisma namespace for types

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

  // Handle message sending from frontend
  socket.on(
    'sendMessage',
    async (data: { chatId: string; message: string }) => {
      console.log('sendMessage event received:', data);
      let sentWAMessage: WAMessage | null = null;
      try {
        const client = getClient();
        sentWAMessage = await client.sendMessage(data.chatId, data.message);
        console.log('Message sent via WhatsApp:', sentWAMessage.id._serialized);

        const waChat: WAChat = await sentWAMessage.getChat();
        const messageTimestamp =
          typeof sentWAMessage.timestamp === 'number'
            ? new Date(sentWAMessage.timestamp * 1000)
            : new Date(); // Fallback to now()

        const messageData: Prisma.MessageCreateInput = {
          id: sentWAMessage.id._serialized,
          chat: { connect: { id: waChat.id._serialized } },
          timestamp: messageTimestamp,
          fromMe: sentWAMessage.fromMe,
          body: sentWAMessage.body || null,
          mediaUrl: sentWAMessage.hasMedia ? 'media_placeholder' : null,
          mediaType: sentWAMessage.hasMedia ? sentWAMessage.type : null,
          // Ensure ack is a number or null
          ack: typeof sentWAMessage.ack === 'number' ? sentWAMessage.ack : null,
        };

        const savedMessage = await prisma.$transaction(async (tx) => {
          // Explicitly type the update data
          const chatUpdateData: Prisma.ChatUpdateInput = {
            lastMessageAt: messageTimestamp,
          };
          await tx.chat.update({
            where: { id: waChat.id._serialized },
            data: chatUpdateData,
          });
          return tx.message.create({
            data: messageData,
          });
        });

        console.log('Saved outgoing message to DB:', savedMessage.id);
        io.emit('message', savedMessage);
      } catch (error) {
        console.error('Error sending or saving message:', error);
        socket.emit('send_message_error', {
          chatId: data.chatId,
          tempId: sentWAMessage?.id._serialized,
          error: 'Failed to send or save message',
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
