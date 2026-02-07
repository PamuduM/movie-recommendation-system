# FlickX

A movie discovery app with a React Native (Expo) mobile frontend and a Node.js/Express + Sequelize backend.

## Prerequisites

- Node.js 20+ (Expo SDK 54 / RN 0.81 requires Node 20+)
- Android Studio Emulator (recommended) or a physical device with Expo Go

## 🚀 Quick Start with VSCode

For detailed instructions on running this project in VSCode terminal with tasks and debugging, see **[VSCODE_GUIDE.md](VSCODE_GUIDE.md)**.

**TL;DR**: Open in VSCode and press `Ctrl+Shift+B` (or `Cmd+Shift+B` on Mac) to run the full stack!

## Run (local dev)

### 1) Start the backend API

```bash
cd backend
npm install
npm run start
```

- Default DB: SQLite (`backend/dev.sqlite`) for zero-setup local development.
- To use Postgres instead, edit `backend/.env` and set `DB_DIALECT=postgres` plus your DB credentials.

Backend base URL:
- `http://localhost:5000/api`

### 2) Start the mobile app

```bash
cd frontend
npm install
npm start
```

Then:
- Press `a` in the Expo terminal to open Android
- Or scan the QR code with Expo Go

## Android emulator networking

The app uses `10.0.2.2` to reach your host machine from the Android emulator.
- API: `http://10.0.2.2:5000/api`
- Socket.IO: `http://10.0.2.2:5000`

## Notes

- Auth is wired end-to-end (JWT stored securely) with a basic login screen.
- Some screens are still scaffold/placeholder UI and can be expanded.
