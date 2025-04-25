# Task List for WhatsApp Automation Prototype

## 1. Setup Monorepo Structure
- [x] Create `backend/` and `frontend/` directories with prescribed structure:
  - `backend/` holds server code, Prisma schema, configs.
  - `frontend/` holds React app, configs.
  - Root contains `prd.md`, `tasks.md`, shared `.env` and README.

## 2. Backend Initialization & Data Layer
- [x] Initialize Node.js/TypeScript project in `backend/`.
  - [ ] Configure `tsconfig.json` and install core deps: express, socket.io, whatsapp-web.js, prisma, sqlite3. (To re-verify/implement)
- [x] Define Prisma schema (`Session`, `Chat`, `Message`) and run migrations.
  - [ ] Configure SQLite datasource and generate `prisma/` folder. (To re-verify/implement)
  - [ ] Execute `prisma migrate dev`. (To re-verify/implement)
- [ ] Integrate Prisma Client in code for CRUD operations. (To implement)

## 3. WhatsApp Client & Real-time Layer (Backend)
- [ ] Set up whatsapp-web.js client with `LocalAuth`. (To implement)
  - [ ] Handle `qr` event: emit QR string over socket.io. (To implement)
  - [ ] Handle `ready` event: fetch chats & emit list. (To implement)
- [x] Integrate socket.io into Express server:
  - [ ] Emit `qr`, `chats`, `message` events to frontend. (To implement)
  - [ ] Listen for `sendMessage` and `sendMedia` events and call WhatsApp API. (To implement)
- [ ] Implement REST endpoints as fallback: (To implement)
  - [ ] `GET /api/chats` (To implement)
  - [ ] `GET /api/messages/:chatId` (To implement)

## 4. Message Persistence & Flow (Backend)
- [ ] On incoming/outgoing messages:
  - [ ] Persist message records via Prisma. (To implement)
  - [ ] Emit saved messages in real time to connected clients. (To implement)
- [ ] Implement error handling and auto-reconnect logic. (To implement)

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

## 8. Backend Implementation Plan (Level 3)

### 8.1 Requirements Analysis
- Implement backend features as per `prd.md` sections 3.2, 4, 5, 6, and 7.
- Core functions: Link WhatsApp via QR, manage session persistence (`LocalAuth`), handle real-time chat/message updates via Socket.IO, persist data using Prisma/SQLite, provide REST fallbacks.

### 8.2 Components Affected
- Entire `backend/` directory.
- Key modules:
    - Express server setup (`server.ts` or `index.ts`)
    - Socket.IO integration and event handlers
    - WhatsApp client initialization and event listeners (`whatsapp.ts`)
    - Prisma setup, schema (`prisma/schema.prisma`), client integration (`db.ts` or similar)
    - API route definitions (`routes/`)
    - Service layer for business logic (e.g., message handling)

### 8.3 Architecture Considerations
- Adhere to the architecture diagram in `prd.md`.
- Maintain separation of concerns: API routes, Socket handlers, WhatsApp interaction logic, Database operations.
- Use TypeScript for type safety.
- Implement proper error handling and logging.

### 8.4 Implementation Strategy
- **Iterative Build:** Implement features section by section from `tasks.md`.
    1.  **Base Setup:** Initialize project, install dependencies, configure TypeScript, set up Prisma schema and migrations.
    2.  **WhatsApp Client:** Integrate `whatsapp-web.js`, handle `qr` and `ready` events basic session persistence (`LocalAuth`).
    3.  **Socket.IO Layer:** Integrate Socket.IO with Express, establish basic connection, emit `qr` code.
    4.  **Data Persistence:** Connect Prisma client, implement saving/retrieving for `Session`, `Chat`, `Message`.
    5.  **Core Features:** Implement chat listing, message sending/receiving via Socket.IO, linking persistence logic.
    6.  **REST Fallbacks:** Add basic API endpoints.
    7.  **Error Handling/Refinement:** Implement reconnect logic, improve error handling.
- **Testing:** Manually test each step using a simple frontend client or tools like Postman/Socket.IO admin UI before integrating with the main React frontend.

### 8.5 Detailed Steps
- Revisit and complete all unchecked tasks under sections 2, 3, and 4 in `tasks.md`.
- Ensure environment variables (`DATABASE_URL`, potentially others) are configured.
- Structure the `backend/src/` directory logically (e.g., `services/`, `controllers/`, `utils/`, `config/`).

### 8.6 Dependencies
- Verify installation and versions of: `typescript`, `ts-node`, `@types/node`, `express`, `@types/express`, `socket.io`, `whatsapp-web.js` (pedroslopez fork recommended), `prisma`, `@prisma/client`, `sqlite3`.

### 8.7 Challenges & Mitigations
- **`whatsapp-web.js` Stability/API:** Library relies on reverse engineering. *Mitigation:* Use recommended fork, lock version, check docs/issues, robust error handling.
- **Session Management (`LocalAuth`):** Ensuring persistence across restarts. *Mitigation:* Test thoroughly, check file permissions, follow library best practices.
- **Real-time Sync:** Handling potential race conditions/missed events. *Mitigation:* Use acknowledgements, unique IDs, consider state sync on reconnect.
- **Prisma Migrations:** Ensuring schema changes handled correctly. *Mitigation:* Follow Prisma workflow (`migrate dev`, `generate`), test DB interactions.

### 8.8 Creative Phase Components
- None identified. Focus is on implementing defined requirements.
