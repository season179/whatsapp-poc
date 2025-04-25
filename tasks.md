# Task List for WhatsApp Automation Prototype

## 1. Setup Monorepo Structure
- [x] Create `backend/` and `frontend/` directories with prescribed structure:
  - `backend/` holds server code, Prisma schema, configs.
  - `frontend/` holds React app, configs.
  - Root contains `prd.md`, `tasks.md`, shared `.env` and README.

## 2. Backend Initialization & Data Layer
- [x] Initialize Node.js/TypeScript project in `backend/`.
  - [x] Configure `tsconfig.json` and install core deps: express, socket.io, whatsapp-web.js, prisma, sqlite3.
- [x] Define Prisma schema (`Session`, `Chat`, `Message`) and run migrations.
  - [x] Configure SQLite datasource and generate `prisma/` folder.
  - [x] Execute `prisma migrate dev`.
- [x] Integrate Prisma Client in code for CRUD operations.

## 3. WhatsApp Client & Real-time Layer (Backend)
- [ ] Set up whatsapp-web.js client with `LocalAuth`.
  - [ ] Handle `qr` event: emit QR string over socket.io.
  - [ ] Handle `ready` event: fetch chats & emit list.
- [ ] Integrate socket.io into Express server:
  - [ ] Emit `qr`, `chats`, `message` events to frontend.
  - [ ] Listen for `sendMessage` and `sendMedia` events and call WhatsApp API.
- [ ] Implement REST endpoints as fallback:
  - [ ] `GET /api/chats`
  - [ ] `GET /api/messages/:chatId`

## 4. Message Persistence & Flow (Backend)
- [ ] On incoming/outgoing messages:
  - [ ] Persist message records via Prisma.
  - [ ] Emit saved messages in real time to connected clients.
- [ ] Implement error handling and auto-reconnect logic.

## 5. Frontend Initialization & Connection
- [ ] Scaffold React/TypeScript project in `frontend/`.
  - [ ] Install socket.io-client and qrcode.react.
- [ ] Initialize socket.io-client and manage connection status.
  - [ ] Subscribe to `qr`, `chats`, `message` events.
  - [ ] Emit `sendMessage` and `sendMedia` events on user actions.

## 6. UI Components (Frontend)
- [ ] Build **QR Scanner** component to render QR for scanning.
- [ ] Build **Chat List** component:
  - [ ] Display chat names, last message, unread counts.
- [ ] Build **Chat Window** component:
  - [ ] Show message history (text & media).
  - [ ] Input box for text; upload for files/images.
  - [ ] Auto-scroll to latest message.

## 7. General Tasks
- [ ] Set up state management in frontend (Context or state library).
- [ ] Update README with setup and run instructions for both apps.
- [ ] Document environment variables and project structure.
- [ ] Configure ESLint and Prettier for consistent code style.
- [ ] Write manual or automated tests for core user flows.
