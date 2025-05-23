// src/main.ts - WhatsApp bot prototype in TypeScript
import { toString as qrToString } from "qrcode";
// Import the default export and access properties
import WAWebJS from "whatsapp-web.js";
// Remove Contact/GroupChat from import, types are inferred
const { Client, LocalAuth, MessageMedia } = WAWebJS; 

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
    const chat = await message.getChat(); // Get chat for checking group status and replying

    // --- Mention Handling ---
    try {
        const mentionedUsers = await message.getMentions();
        for (const contact of mentionedUsers) {
            // contact type is inferred here
            console.log(`User mentioned: ${contact.pushname || contact.id.user} (${contact.id._serialized})`);
        }

        // Check chat.isGroup instead of message.isGroup
        if (chat.isGroup) { 
            const mentionedGroups = await message.getGroupMentions();
             for (const group of mentionedGroups) {
                 // group type is inferred here
                console.log(`Group mentioned: ${group.name} (${group.id._serialized})`);
            }
        }
       
        // Simple !mentionme command
        if (message.body === '!mentionme') {
            const sender = await message.getContact(); // sender type is inferred
             // Use sender's serialized ID for mentions array
            await chat.sendMessage(`Hello @${sender.id.user}!`, {
                mentions: [sender.id._serialized] 
            });
            console.log(`Replied to !mentionme from ${sender.id.user}`);
        }

    } catch (error) {
        console.error("Error handling mentions:", error);
    }
    // --- End Mention Handling ---


    // --- Attachment Handling ---
    if (message.hasMedia) {
        console.log(`Message from ${message.from} has media, attempting to download...`);
        try {
            const media = await message.downloadMedia(); // media type is inferred
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
    // --- End Attachment Handling ---
});

// Initialize the client
client.initialize();
