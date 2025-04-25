# Task List for WhatsApp Automation Prototype

## 1. Setup Monorepo Structure
- [x] Create `backend/` and `frontend/` directories with prescribed structure:
  - `backend/` holds server code, Prisma schema, configs.
  - `frontend/` holds React app, configs.
  - Root contains `prd.md`, `tasks.md`, shared `.env` and README.

## 2. Backend Initialization & Data Layer
- [x] Initialize Node.js/TypeScript project in `backend/`.
  - [ ] Configure `tsconfig.json` and install core deps: express, socket.io, whatsapp-web.js, prisma, sqlite3.
- [x] Define Prisma schema (`Session`, `Chat`, `Message`) and run migrations.
  - [x] Configure SQLite datasource and generate `prisma/` folder.
  - [x] Execute `prisma migrate dev`.
- [x] Integrate Prisma Client in code for CRUD operations.

## 3. WhatsApp Client & Real-time Layer (Backend)
- [x] Set up whatsapp-web.js client with `LocalAuth`.
  - [x] Handle `qr` event: emit QR string over socket.io.
  - [x] Handle `ready` event: fetch chats & emit list.
- [x] Integrate socket.io into Express server:
  - [x] Emit `qr`, `chats`, `message` events to frontend.
  - [x] Listen for `sendMessage` and `sendMedia` events and call WhatsApp API.
- [x] Implement REST endpoints as fallback:
  - [x] `GET /api/chats`
  - [x] `GET /api/messages/:chatId`

## 4. Message Persistence & Flow (Backend)
- [ ] On incoming/outgoing messages:
  - [x] Persist message records via Prisma.
  - [x] Emit saved messages in real time to connected clients.
- [ ] Implement error handling and auto-reconnect logic.

## 5. Frontend Initialization & Connection
- [x] Scaffold React/TypeScript project in `frontend/`.
  - [x] Install socket.io-client and qrcode.react.
- [x] Initialize socket.io-client and manage connection status.
  - [x] Subscribe to `qr`, `chats`, `message` events.
  - [x] Emit `sendMessage` and `sendMedia` events on user actions.

## 6. UI Components (Frontend)
- [x] Build **QR Scanner** component to render QR for scanning.
- [x] Build **Chat List** component:
  - [x] Display chat names, last message, unread counts.
- [x] Build **Chat Window** component:
  - [x] Show message history (text & media).
  - [x] Input box for text; upload for files/images.
  - [x] Auto-scroll to latest message.

## 7. General Tasks
- [x] Set up state management in frontend (Context or state library).
- [x] Update README with setup and run instructions for both apps.
- [x] Document environment variables and project structure.
- [x] Configure ESLint and Prettier for consistent code style.
