// src/main.ts - WhatsApp bot prototype in TypeScript
import { toString as qrToString } from "qrcode";
// Import the default export and access properties
import WAWebJS from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = WAWebJS; // Destructure from the default export

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
});

// Listen for QR code event
client.on("qr", async (qr: string) => {
    console.log("Scan this QR code to link your WhatsApp:");
    try {
        const qrTerminal = await qrToString(qr, {
            type: "terminal",
            small: true,
        });
        console.log(qrTerminal);
    } catch (error) {
        console.error("Failed to generate QR code:", error);
    }
});

// When client is ready
client.on("ready", () => {
    console.log("Client is ready!");
});

// Listen for incoming messages
client.on("message_create", async (message) => {
    console.log(`Received message from ${message.from}: ${message.body}`);

    // Check if the message has media
    if (message.hasMedia) {
        console.log(`Message from ${message.from} has media, attempting to download...`);
        try {
            const media = await message.downloadMedia();
            if (media) {
                // Log media details
                console.log(`Media downloaded:
                  Filename: ${media.filename || 'N/A'}
                  Type: ${media.mimetype}
                  Size: ${media.data.length} bytes (base64)`);
                // TODO: Add logic to save or process the media data (media.data)
            } else {
                console.log(`Failed to download media from message ${message.id._serialized}`);
            }
        } catch (error) {
            console.error(`Error downloading media from message ${message.id._serialized}:`, error);
        }
    }
});

// Initialize the client
client.initialize();
