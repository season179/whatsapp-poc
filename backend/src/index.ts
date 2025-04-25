import express, { Request, Response } from 'express';
import http from "http";
import { Server } from "socket.io";
import { Client, LocalAuth, MessageMedia, WAState } from "whatsapp-web.js";
import { upsertChat, createMessage, getMessagesByChat } from "./data";
import prisma from './prisma';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let currentQR: string | null = null;
let currentChats: any[] = [];
let clientReady = false;

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot" }),
});

client.on("qr", (qr) => {
    console.log("QR Code Received");
    currentQR = qr;
    clientReady = false;
    io.emit("qr", qr);
});

client.on("ready", async () => {
    console.log("WhatsApp client is ready");
    currentQR = null;
    clientReady = true;
    try {
        const chats = await client.getChats();
        currentChats = chats
            .filter(chat => !chat.isGroup)
            .map((chat) => ({
                id: chat.id._serialized,
                name: chat.name || chat.id.user || "Unknown",
                lastMessage: chat.lastMessage?.body || '',
                timestamp: chat.timestamp,
            }));
        io.emit("ready");
        io.emit("chats", currentChats);
        console.log(`Emitted ${currentChats.length} chats.`);
    } catch (err) {
        console.error("Error fetching or emitting chats on ready:", err);
    }
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    clientReady = false;
    currentQR = null;
    currentChats = [];
    io.emit('disconnect_whatsapp');
});

client.on("message", async (message) => {
    try {
        if (!message.from || !message.to || !message.body) return;

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
        };
        io.emit("message", emitMessage);

        currentChats = currentChats.map(c => c.id === saved.chatId ? { ...c, lastMessage: saved.content, timestamp: saved.timestamp.getTime() } : c);
    } catch (err) {
        console.error("Error processing/saving incoming message:", err);
    }
});

io.on("connection", async (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    try {
        const state = await client.getState();
        console.log(`Client state on connect: ${state}`);

        if (state === WAState.CONNECTED && clientReady) {
            console.log(`Sending 'ready' and ${currentChats.length} chats to ${socket.id}`);
            socket.emit('ready');
            socket.emit('chats', currentChats);
        } else if (currentQR) {
            console.log(`Sending stored QR to ${socket.id}`);
            socket.emit('qr', currentQR);
        } else {
            console.log(`Client not ready and no QR available for ${socket.id}. Waiting for events.`);
        }
    } catch (err) {
        console.error(`Error getting client state for ${socket.id}:`, err);
        if (currentQR) {
            console.log(`Sending stored QR to ${socket.id} (fallback)`);
            socket.emit('qr', currentQR);
        }
    }

    socket.on("sendMessage", async ({ chatId, content }) => {
        try {
            console.log(`Attempting to send message to ${chatId}`);
            await client.sendMessage(chatId, content);
            console.log(`Message sent successfully to ${chatId}`);
        } catch (err) {
            console.error(`Error sending message to ${chatId}:`, err);
        }
    });

    socket.on("sendMedia", async ({ chatId, media }) => {
        try {
            console.log(`Attempting to send media to ${chatId}: ${media.filename}`);
            const mediaMessage = new MessageMedia(
                media.mimetype,
                media.data,
                media.filename
            );
            await client.sendMessage(chatId, mediaMessage);
            console.log(`Media sent successfully to ${chatId}`);
        } catch (err) {
            console.error(`Error sending media to ${chatId}:`, err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

app.get("/api/messages/:chatId", async (req: Request, res: Response) => {
    const stringChatId = req.params.chatId;
    try {
        // 1. Find the chat record using the string ID to get the numeric ID
        const chat = await prisma.chat.findUnique({
            where: { chatId: stringChatId },
        });

        if (!chat) {
            console.log(`Chat not found in DB for chatId: ${stringChatId}`);
            return res.status(404).json({ error: "Chat not found" });
        }

        // 2. Fetch messages using the numeric chat ID
        const messages = await getMessagesByChat(chat.id);

        // 3. Format messages for the frontend
        const formattedMessages = messages.map((m) => ({
            id: m.messageId,
            fromMe: m.fromMe,
            content: m.content, // Use the 'content' field saved from message.body
            timestamp: m.timestamp.toISOString(),
            type: m.type, // Include type if needed by frontend
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

client.initialize().catch(err => {
    console.error("WhatsApp Client Initialization Error:", err);
});
