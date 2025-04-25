import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import { upsertChat, createMessage } from "./data";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Initialize WhatsApp client with persistent LocalAuth
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot" }),
});

// Emit QR code for login
client.on("qr", (qr) => {
    io.emit("qr", qr);
});

// On ready, fetch chats and emit to clients
client.on("ready", async () => {
    console.log("WhatsApp client is ready");
    const chats = await client.getChats();
    const chatData = chats.map((chat) => ({
        id: chat.id._serialized,
        name: chat.name || "Unknown",
    }));
    io.emit("chats", chatData);
});

// Persist and emit incoming messages
client.on("message", async (message) => {
    try {
        const chatInst = await message.getChat();
        const chatRec = await upsertChat(chatInst.id._serialized, chatInst.name);
        const saved = await createMessage({
            messageId: message.id._serialized,
            chatId: chatRec.id,
            fromMe: message.fromMe,
            content: message.body,
            timestamp: new Date(message.timestamp * 1000),
            type: message.type
        });
        io.emit("message", saved);
    } catch (err) {
        console.error("Error saving incoming message", err);
    }
});

// Socket.io event handlers for outgoing messages
io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("sendMessage", async ({ chatId, content }) => {
        await client.sendMessage(chatId, content);
    });

    socket.on("sendMedia", async ({ chatId, media }) => {
        const mediaMessage = new MessageMedia(
            media.mimetype,
            media.data,
            media.filename
        );
        await client.sendMessage(chatId, mediaMessage);
    });
});

// REST fallback endpoints
app.get("/api/chats", async (req: Request, res: Response) => {
    const chats = await client.getChats();
    const chatData = chats.map((chat) => ({
        id: chat.id._serialized,
        name: chat.name || "Unknown",
    }));
    res.json(chatData);
});

app.get("/api/messages/:chatId", async (req: Request, res: Response) => {
    const chatId = req.params.chatId;
    try {
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 100 });
        const messageData = messages.map((msg) => ({
            id: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            timestamp: msg.timestamp,
            type: msg.type,
        }));
        res.json(messageData);
    } catch (error) {
        console.error("Error fetching messages", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// Error handling & auto-reconnect
client.on("auth_failure", (msg) => {
    console.error("Auth failure", msg);
});
client.on("disconnected", (reason) => {
    console.warn("Client disconnected", reason);
    setTimeout(() => client.initialize(), 5000);
});

// Start server and WhatsApp client
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
client.initialize();
