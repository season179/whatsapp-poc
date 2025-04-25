import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './db';

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

    // Example: Update session status in DB
    try {
      await prisma.session.upsert({
        where: { clientId: client.info.wid._serialized || 'default' },
        update: { status: 'connected', lastSync: new Date() },
        create: {
          clientId: client.info.wid._serialized || 'default',
          status: 'connected',
          lastSync: new Date(),
        },
      });
    } catch (error) {
      console.error('Error updating session status:', error);
    }

    // TODO: Fetch initial chats and emit?
  });

  // Event: Message received
  client.on('message_create', async (message) => {
    console.log('Message received:', message.body);

    // TODO: Persist message to DB
    // TODO: Emit message to frontend

    // Example: Auto-reply (use with caution!)
    // if (message.body === '/ping') {
    //   await client.sendMessage(message.from, 'pong');
    // }
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
