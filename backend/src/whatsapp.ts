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

  console.log('[WApp] Initializing WhatsApp client instance...');
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'client-one' }), // Specify a clientId
    puppeteer: {
      headless: true, // Run headless
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Args required for some Linux environments
    },
  });

  // Event: QR code generated
  client.on('qr', (qr) => {
    console.log('[WApp Event - qr] QR Code Received. Emitting to frontend.');
    io.emit('qr', qr); // Send QR code string to frontend
  });

  // Event: Loading screen progress
  client.on('loading_screen', (percent, message) => {
    console.log(
      `[WApp Event - loading_screen] Progress: ${percent}% - ${message}`
    );
  });

  // Event: Client is authenticated
  client.on('authenticated', () => {
    console.log('[WApp Event - authenticated] Client is authenticated!');
    // Session saved automatically by LocalAuth
  });

  // Event: LocalAuth saved session
  client.on('remote_session_saved', () => {
    console.log(
      '[WApp Event - remote_session_saved] Session data saved by LocalAuth.'
    );
  });

  // Event: Authentication failure
  client.on('auth_failure', (msg) => {
    console.error('[WApp Event - auth_failure] AUTHENTICATION FAILURE:', msg);
    io.emit('auth_failure', msg);
  });

  // Event: Client is ready
  client.on('ready', async () => {
    console.log('[WApp Event - ready] Client is ready!');
    io.emit('ready'); // Notify frontend that client is ready

    try {
      console.log('[WApp Ready] Updating session status in DB...');
      await prisma.session.upsert({
        where: { clientId: client.info.wid._serialized || 'client-one' }, // Use same clientId
        update: { status: 'connected', lastSync: new Date() },
        create: {
          clientId: client.info.wid._serialized || 'client-one',
          status: 'connected',
          lastSync: new Date(),
        },
      });
      console.log('[WApp Ready] Session status updated.');

      // Fetch and sync chats
      console.log('[WApp Ready] Fetching chats from WhatsApp...');
      const waChats: WAChat[] = await client.getChats();
      console.log(
        `[WApp Ready] Fetched ${waChats.length} chats from WhatsApp.`
      );

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
      console.log('[WApp Ready] Finished syncing chats to DB.');

      // Fetch all chats from DB to send to frontend
      console.log('[WApp Ready] Fetching synced chats from DB...');
      const allDbChats = await prisma.chat.findMany({
        orderBy: { lastMessageAt: 'desc' },
      });
      console.log(
        `[WApp Ready] Fetched ${allDbChats.length} chats from DB. Emitting to frontend...`
      );
      io.emit('chats', allDbChats);
      console.log('[WApp Ready] Emitted chats to frontend.');
    } catch (error) {
      console.error('[WApp Ready] Error during ready event processing:', error);
      io.emit('error', 'Failed to initialize chats');
    }
  });

  // Event: Message received
  client.on('message_create', async (message: WAMessage) => {
    console.log('[WApp Event - message_create] Received message_create event');
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

  // Event: Disconnected
  client.on('disconnected', async (reason) => {
    console.warn('[WApp Event - disconnected] Client was logged out:', reason);
    io.emit('disconnected', reason);
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
  console.log('[WApp] Calling client.initialize()...');
  client
    .initialize()
    .then(() => {
      console.log('[WApp] client.initialize() promise resolved.');
    })
    .catch((err) => {
      console.error('[WApp] client.initialize() failed:', err);
      io.emit('init_error', 'Client initialization failed');
    });
  console.log('[WApp] client.initialize() called.');

  return client;
};

// Function to get the initialized client instance
export const getClient = (): Client => {
  if (!client) {
    throw new Error('WhatsApp client is not initialized.');
  }
  return client;
};
