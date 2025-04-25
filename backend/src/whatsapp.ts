import {
  Client,
  LocalAuth,
  Message as WAMessage,
  Chat as WAChat,
} from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './db';
import { Prisma } from '@prisma/client';

let client: Client;
let io: SocketIOServer;

// Function to initialize the WhatsApp client
export const initializeWhatsAppClient = (socketIoServer: SocketIOServer) => {
  io = socketIoServer; // Store the io instance

  console.log('Initializing WhatsApp client...');
  client = new Client({
    authStrategy: new LocalAuth(), // Use local session saving
    puppeteer: {
      // args: ['--no-sandbox', '--disable-setuid-sandbox'], // Args required for some Linux environments
    },
  });

  // Event: QR code generated
  client.on('qr', (qr) => {
    console.log('QR Code Received, emitting to frontend.');
    // qrcode.generate(qr, { small: true }); // Optional: Display QR in terminal
    io.emit('qr', qr); // Send QR code string to frontend
  });

  // Event: Client is ready
  client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    io.emit('ready'); // Notify frontend

    try {
      // Update session status
      await prisma.session.upsert({
        where: { clientId: client.info.wid._serialized || 'default' },
        update: { status: 'connected', lastSync: new Date() },
        create: {
          clientId: client.info.wid._serialized || 'default',
          status: 'connected',
          lastSync: new Date(),
        },
      });

      // Fetch and sync chats
      console.log('Fetching chats...');
      const waChats: WAChat[] = await client.getChats();
      console.log(`Fetched ${waChats.length} chats.`);

      const chatUpsertPromises = waChats.map(async (chat) => {
        // Skip chats that might cause issues (e.g., announcements)
        if (!chat.id._serialized) return null;

        const chatData: Prisma.ChatUpsertArgs = {
          where: { id: chat.id._serialized },
          update: {
            name: chat.name || chat.id.user,
            isGroup: chat.isGroup,
            archived: chat.archived,
            pinned: chat.pinned,
            // lastMessageAt and unreadCount are harder to sync reliably here,
            // best updated via message events or specific chat update events.
          },
          create: {
            id: chat.id._serialized,
            name: chat.name || chat.id.user,
            isGroup: chat.isGroup,
            archived: chat.archived,
            pinned: chat.pinned,
            lastMessageAt: chat.timestamp
              ? new Date(chat.timestamp * 1000)
              : null,
            unreadCount: chat.unreadCount,
          },
        };
        try {
          return prisma.chat.upsert(chatData);
        } catch (upsertError) {
          console.error(
            `Error upserting chat ${chat.id._serialized}:`,
            upsertError
          );
          return null;
        }
      });

      await Promise.all(chatUpsertPromises.filter((p) => p !== null));
      console.log('Finished syncing chats to DB.');

      // Fetch all chats from DB to send to frontend
      const allDbChats = await prisma.chat.findMany({
        orderBy: { lastMessageAt: 'desc' }, // Order by most recent activity
      });
      io.emit('chats', allDbChats);
      console.log('Emitted chats to frontend.');
    } catch (error) {
      console.error('Error during ready event processing:', error);
      io.emit('error', 'Failed to initialize chats');
    }
  });

  // Event: Message received (both incoming and outgoing)
  client.on('message_create', async (message: WAMessage) => {
    console.log('message_create event fired');
    // message.fromMe indicates if the message was sent by the bot account
    // We only process/save if it's relevant (e.g., not saving our own outgoing here if handled separately)
    if (message.fromMe) {
      console.log('Skipping own outgoing message in message_create handler.');
      // Outgoing messages will be persisted after successful send via the socket handler
      return;
    }

    console.log(`Received message from ${message.from}:`, message.body);

    try {
      const chat = await message.getChat();
      const contact = await message.getContact();

      const chatData = {
        id: chat.id._serialized,
        name: chat.isGroup
          ? chat.name
          : contact.name || contact.pushname || chat.id.user,
        isGroup: chat.isGroup,
        lastMessageAt: new Date(message.timestamp * 1000),
        archived: chat.archived,
        pinned: chat.pinned,
        // unreadCount needs careful handling, might need updates from 'unread_count' event
      };

      const messageData = {
        id: message.id._serialized,
        chatId: chat.id._serialized,
        timestamp: new Date(message.timestamp * 1000),
        fromMe: message.fromMe,
        body: message.body || null,
        mediaUrl: message.hasMedia ? 'media_placeholder' : null, // Placeholder - media handling is complex
        mediaType: message.hasMedia ? message.type : null,
        ack: message.ack,
      };

      // Use transaction to ensure chat exists before adding message
      const savedMessage = await prisma.$transaction(async (tx) => {
        await tx.chat.upsert({
          where: { id: chatData.id },
          update: {
            name: chatData.name,
            lastMessageAt: chatData.lastMessageAt,
            archived: chatData.archived,
            pinned: chatData.pinned,
          },
          create: chatData,
        });

        return tx.message.create({
          data: messageData,
        });
      });

      console.log('Saved incoming message to DB:', savedMessage.id);

      // Emit the *saved* message data (or a formatted version) to the frontend
      io.emit('message', savedMessage);
    } catch (error) {
      console.error('Error processing/saving incoming message:', error);
    }
  });

  // Event: Authentication failure
  client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE:', msg);
    io.emit('auth_failure'); // Notify frontend
  });

  // Event: Disconnected
  client.on('disconnected', async (reason) => {
    console.log('Client was logged out:', reason);
    io.emit('disconnected'); // Notify frontend
    // Example: Update session status
    try {
      await prisma.session.updateMany({
        where: { clientId: client.info?.wid?._serialized || 'default' },
        data: { status: 'disconnected' },
      });
    } catch (error) {
      console.error('Error updating session status on disconnect:', error);
    }
    // Optional: Attempt to re-initialize or handle cleanup
    // initializeWhatsAppClient(io);
  });

  // Start the client initialization
  client.initialize().catch((err) => {
    console.error('Client initialization error:', err);
    io.emit('init_error');
  });

  return client;
};

// Function to get the initialized client instance
export const getClient = (): Client => {
  if (!client) {
    throw new Error('WhatsApp client is not initialized.');
  }
  return client;
};
