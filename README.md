# WhatsApp Automation Prototype

## 1. Purpose & Background

This project is a prototype demonstrating end-to-end automation of WhatsApp tasks using `whatsapp-web.js`. It serves as a starter kit for building chat-based integrations with a React frontend and a Node.js backend.

See [prd.md](./prd.md) for detailed product requirements and [tasks.md](./tasks.md) for the implementation checklist.

## 2. Tech Stack

*   **Language:** TypeScript
*   **Backend:** Node.js, Express, Socket.IO, Prisma, `whatsapp-web.js`
*   **Frontend:** React, Vite, `socket.io-client`, `qrcode.react`
*   **Database:** SQLite

## 3. Project Structure

```
whatsapp-bot/
├── backend/        # Node.js backend application
│   ├── prisma/       # Prisma schema and migrations
│   ├── src/          # Backend source code (TypeScript)
│   ├── dist/         # Compiled JavaScript (output)
│   ├── node_modules/
│   ├── package.json
│   └── tsconfig.json
├── frontend/       # React frontend application
│   ├── src/          # Frontend source code (TypeScript/TSX)
│   ├── public/
│   ├── node_modules/
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
├── prd.md
├── tasks.md
└── README.md       # This file
```

## 4. Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd whatsapp-bot
    ```
2.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install
    ```
3.  **Run Backend Database Migrations:**
    *This sets up the SQLite database file (`dev.db`) based on the schema.*
    ```bash
    # Still in the backend directory
    npx prisma migrate dev --name init 
    # Or use the npm script:
    # npm run prisma:migrate --name init
    ```
4.  **Install Frontend Dependencies:**
    ```bash
    cd ../frontend 
    npm install
    ```

## 5. Running the Application

1.  **Start the Backend Server:**
    *Open a terminal in the `backend/` directory.*
    ```bash
    npm run dev 
    ```
    *The backend will attempt to initialize the WhatsApp client. If it's the first time or the session is lost, it will print a QR code in the terminal and send it to the frontend.* 

2.  **Start the Frontend Development Server:**
    *Open a separate terminal in the `frontend/` directory.*
    ```bash
    npm run dev
    ```
    *Vite will typically start the server on `http://localhost:5173`. Open this URL in your browser.*

3.  **Connect WhatsApp:**
    *   If the backend requires authentication, the frontend will display a QR code.
    *   Open WhatsApp on your phone, go to `Settings > Linked Devices > Link a Device`, and scan the QR code.
    *   Once connected, the status should change to "WhatsApp Ready," and your chats should appear.

## 6. Environment Variables

Currently, no specific environment variables are required to run the prototype. The backend runs on port 3001 by default (see `backend/src/index.ts`) and the frontend uses Vite's default port (usually 5173).
