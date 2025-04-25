import express, { Request, Response } from 'express';
import http from "http";
import { Server } from "socket.io";
import { Client, LocalAuth, MessageMedia, WAState } from "whatsapp-web.js";
import { upsertChat, createMessage, getMessagesByChat } from "./data";
import prisma from './prisma';
import qrcode from 'qrcode-terminal'; // For terminal QR display

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let currentQR: string | null = null;
let currentChats: any[] = [];
let clientReady = false;

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot" }),
    puppeteer: {
        headless: true, // Run headless for production/server
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

client.on("qr", (qr) => {
    console.log("QR Code Received");
    currentQR = qr;
    clientReady = false;
    io.emit("status", "QR Code Received");
    io.emit("qr", qr);
    // Optionally display QR in terminal for debugging
    qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
    console.log('[READY_EVENT] Client is ready! Starting chat processing...');
    clientReady = true;
    currentQR = null; // Clear QR code
    io.emit('status', 'WhatsApp Ready'); // Emit global status
    io.emit('ready'); // Emit ready event

    try {
        console.log('[READY_EVENT] Fetching chats...');
        const fetchedChats = await client.getChats();
        console.log(`[READY_EVENT] Fetched ${fetchedChats.length} chats. Mapping...`);
        currentChats = await Promise.all(
            fetchedChats
                // Filter out groups for simplicity in this example if needed
                // .filter(chat => !chat.isGroup)
                .map(async (chat, index) => {
                    console.log(`[READY_EVENT] Processing chat ${index + 1}/${fetchedChats.length}: ${chat.id._serialized}`);
                    // Upsert chat in DB
                    await upsertChat(chat.id._serialized, chat.name);
                    // Fetch last message (consider limiting this for performance)
                    console.log(`[READY_EVENT] Fetching messages for chat ${chat.id._serialized}...`);
                    const messages = await chat.fetchMessages({ limit: 1 });
                    const lastMessage = messages[0]; // Might be undefined if no messages
                    console.log(`[READY_EVENT] Done processing chat ${chat.id._serialized}`);

                    return {
                        id: chat.id._serialized,
                        name: chat.name || chat.id.user,
                        isGroup: chat.isGroup,
                        lastMessage: lastMessage ? lastMessage.body : 'No messages yet',
                        timestamp: lastMessage ? new Date(lastMessage.timestamp * 1000) : new Date(),
                        unreadCount: chat.unreadCount, // Added unreadCount
                    };
                })
        );
        console.log('[READY_EVENT] Chat mapping complete. Emitting chats to all clients...');
        io.emit('chats', currentChats);
        console.log('[READY_EVENT] Chats emitted.');
    } catch (err) {
        console.error('[READY_EVENT] Error fetching or processing chats on ready:', err);
        // Optionally emit an error to the frontend
        io.emit('status', 'Error loading chats');
    }
});

client.on('auth_failure', (msg) => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE:', msg);
    clientReady = false;
    currentQR = null; // Reset QR state
    let retryCount = 0; // Reset retries as auth failed
    io.emit('status', 'Authentication Failed');
    io.emit('auth_failure'); // Inform frontend
    // Consider stopping retries here or specific handling
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    clientReady = false;
    currentQR = null;
    currentChats = [];
    io.emit('status', 'Disconnected');
    io.emit('disconnect_whatsapp', reason);
    // Attempt to re-initialize after a delay
    console.log('Attempting to re-initialize WhatsApp client...');
    setTimeout(() => initializeClient(), 5000); // Wait 5 seconds before retry
});

// Add state change monitoring
client.on('change_state', state => {
    console.log('WhatsApp client state changed to:', state);
    io.emit('status', `State: ${state}`);
    if (state === WAState.CONFLICT || state === WAState.UNPAIRED || state === WAState.UNLAUNCHED) {
        // These states often require re-authentication (new QR)
        clientReady = false;
        currentQR = null;
        currentChats = [];
        console.log('Client state requires re-authentication. Attempting destroy and re-initialize.');
        // Attempt to destroy and restart the client process to get a new QR
        client.destroy().then(() => initializeClient()).catch(e => console.error('Error destroying client:', e));
    }
});

client.on("message", async (message) => {
    try {
        if (!message.from || !message.to) return; // Allow messages without body (e.g., media)
        const chatInst = await message.getChat();
        const chatName = chatInst.name || chatInst.id.user || 'Unknown';
        const chatRec = await upsertChat(chatInst.id._serialized, chatName);

        const saved = await createMessage({
            messageId: message.id._serialized,
            chatId: chatRec.id,
            fromMe: message.fromMe,
            content: message.body,
            timestamp: new Date(message.timestamp * 1000),
            type: message.type
        });

        const emitMessage = {
            id: saved.messageId,
            chatId: saved.chatId,
            fromMe: saved.fromMe,
            content: saved.content,
            timestamp: saved.timestamp.toISOString(),
            type: saved.type
        };
        io.emit("message", emitMessage);

        currentChats = currentChats.map(c =>
            c.id === chatRec.chatId ? { ...c, lastMessage: saved.content, timestamp: saved.timestamp.getTime() / 1000 } : c
        ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Keep sorted

    } catch (err) {
        console.error("Error processing/saving incoming message:", err);
    }
});

io.on("connection", async (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Check flags instead of calling getState()
    if (clientReady) {
        console.log(`Client ready. Sending 'ready' and ${currentChats.length} chats to ${socket.id}`);
        socket.emit('status', 'WhatsApp Ready'); // Send status first
        socket.emit('ready');
        socket.emit('chats', currentChats);
    } else if (currentQR) {
        console.log(`Client not ready, sending stored QR to ${socket.id}`);
        socket.emit('status', 'QR Code Received'); // Send status first
        socket.emit('qr', currentQR);
    } else {
        // Client not ready and no QR code available yet
        console.log(`Client initializing, no QR yet for ${socket.id}. Waiting for events.`);
        socket.emit('status', 'Initializing...');
    }

    socket.on("sendMessage", async ({ chatId, content }) => {
        if (!clientReady) {
            console.error("sendMessage failed: Client not ready");
            socket.emit('send_error', { chatId, error: 'WhatsApp client not ready' });
            return;
        }
        if (!chatId || !content) {
            console.error("sendMessage failed: Missing chatId or content");
            socket.emit('send_error', { chatId, error: 'Missing chatId or content' });
            return;
        }

        try {
            console.log(`Attempting to send message to ${chatId}`);
            const sentMessage = await client.sendMessage(chatId, content);
            console.log(`Message sent successfully to ${chatId}, ID: ${sentMessage.id._serialized}`);

            const chatRec = await upsertChat(chatId); // Ensure chat exists
            const savedOutgoing = await createMessage({
                messageId: sentMessage.id._serialized,
                chatId: chatRec.id, // Use the numeric ID from the DB record
                fromMe: true,
                content: content,
                timestamp: new Date(sentMessage.timestamp * 1000),
                type: sentMessage.type
            });
            console.log(`Outgoing message persisted: ${savedOutgoing.id}`);

        } catch (err) {
            console.error(`Error sending message to ${chatId}:`, err);
            socket.emit('send_error', { chatId, error: `Failed to send message: ${err}` });
        }
    });

    socket.on("sendMedia", async ({ chatId, media }) => {
        if (!clientReady) {
            console.error("sendMedia failed: Client not ready");
            socket.emit('send_error', { chatId, error: 'WhatsApp client not ready' });
            return;
        }
        if (!chatId || !media || !media.mimetype || !media.data || !media.filename) {
            console.error("sendMedia failed: Missing chatId or media details");
            socket.emit('send_error', { chatId, error: 'Missing chatId or media details' });
            return;
        }

        try {
            console.log(`Attempting to send media to ${chatId}: ${media.filename}`);
            const mediaMessage = new MessageMedia(
                media.mimetype,
                media.data,
                media.filename
            );
            const sentMediaMessage = await client.sendMessage(chatId, mediaMessage);
            console.log(`Media sent successfully to ${chatId}, ID: ${sentMediaMessage.id._serialized}`);

            const chatRec = await upsertChat(chatId); // Ensure chat exists
            const savedOutgoingMedia = await createMessage({
                messageId: sentMediaMessage.id._serialized,
                chatId: chatRec.id, // Use the numeric ID from the DB record
                fromMe: true,
                content: media.filename, // Store filename as content for media
                timestamp: new Date(sentMediaMessage.timestamp * 1000),
                type: sentMediaMessage.type
            });
            console.log(`Outgoing media message persisted: ${savedOutgoingMedia.id}`);

        } catch (err) {
            console.error(`Error sending media to ${chatId}:`, err);
            socket.emit('send_error', { chatId, error: `Failed to send media: ${err}` });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

app.get("/api/messages/:chatId", async (req: Request, res: Response) => {
    const stringChatId = req.params.chatId;
    try {
        const chat = await prisma.chat.findUnique({
            where: { chatId: stringChatId },
        });

        if (!chat) {
            console.log(`Chat not found in DB for chatId: ${stringChatId}`);
            return res.status(404).json({ error: "Chat not found" });
        }

        const messages = await getMessagesByChat(chat.id);

        const formattedMessages = messages.map((m) => ({
            id: m.messageId,
            chatId: m.chatId,
            fromMe: m.fromMe,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            type: m.type
        }));
        res.json(formattedMessages);
    } catch (error) {
        console.error(`Error fetching messages for chat ${stringChatId}:`, error);
        res.status(500).send("Error fetching messages");
    }
});

app.get("/api/chats", async (req: Request, res: Response) => {
    try {
        if (clientReady) {
            res.json(currentChats);
        } else {
            res.status(503).json({ error: "WhatsApp client not ready" });
        }
    } catch (error) {
        console.error("Error fetching chats via API:", error);
        res.status(500).send("Error fetching chats");
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Wrap initialization in a function for retries
async function initializeClient(retryCount = 0) {
    console.log(`Initializing WhatsApp client (Attempt ${retryCount + 1})...`);
    io.emit('status', 'Initializing...');
    client.initialize().catch(err => {
        console.error(`WhatsApp Client Initialization Error (Attempt ${retryCount + 1}):`, err);
        io.emit('status', 'Initialization Error');
        if (retryCount < 3) { // Limit retries
            console.log(`Retrying initialization in 10 seconds...`);
            setTimeout(() => initializeClient(retryCount + 1), 10000);
        } else {
            console.error('Max initialization retries reached. Please restart the application.');
            io.emit('status', 'Initialization Failed - Restart Required');
        }
    });
}

// Start the initial client initialization
initializeClient();
