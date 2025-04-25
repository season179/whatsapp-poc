// src/main.ts - WhatsApp bot prototype in TypeScript
import { toString as qrToString } from 'qrcode';
import { Client } from 'whatsapp-web.js';

const client = new Client({});

// Listen for QR code event
client.on('qr', async (qr: string) => {
  console.log('Scan this QR code to link your WhatsApp:');
  try {
    const qrTerminal = await qrToString(qr, { type: 'terminal', small: true });
    console.log(qrTerminal);
  } catch (error) {
    console.error('Failed to generate QR code:', error);
  }
});

// When client is ready
client.on('ready', () => {
  console.log('Client is ready!');
});

// Listen for incoming messages
client.on('message_create', (message) => {
  console.log(`Received message from ${message.from}: ${message.body}`);
});

// Initialize the client
client.initialize();
