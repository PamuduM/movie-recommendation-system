# Running FlickX in VSCode Terminal

This guide explains how to run the FlickX movie recommendation system using VSCode's integrated terminal and tasks.

## Prerequisites

Before running the project, ensure you have:

1. **Node.js 20+** installed (required for Expo SDK 54 / React Native 0.81)
2. **VSCode** installed
3. **Android Studio Emulator** (recommended) or a physical device with Expo Go
4. All dependencies installed (see below)

## Quick Start - Using VSCode Tasks

VSCode tasks have been configured to make running this project easy. You can access them via:
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Type "Tasks: Run Task"
- Select the task you want to run

### Even Quicker - Root Level NPM Scripts

For the fastest setup, you can also use root-level npm scripts from the terminal:

```bash
# Install all dependencies
npm run setup

# Run full stack (backend + frontend)
npm run dev

# Run backend only
npm run start:backend

# Run frontend only
npm run start:frontend

# Run on Android directly
npm run android

# Show quick start guide
npm run quickstart
```

### Available Tasks

#### 1. **Install All Dependencies**
Run this first to install all required packages for both backend and frontend.
- Task name: `Install All Dependencies`
- This will run `npm install` in both `backend` and `frontend` directories in parallel

#### 2. **Run Full Stack (Backend + Frontend)** ⭐ DEFAULT
Run the complete application (backend API + frontend Expo app).
- Task name: `Run Full Stack (Backend + Frontend)`
- This is the **default build task** - Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
- Opens two terminal panels: one for backend, one for frontend
- Backend will run on `http://localhost:5000`
- Frontend will show Expo QR code and options

#### 3. **Start Backend Server**
Run only the backend API server.
- Task name: `Start Backend Server`
- Runs on `http://localhost:5000/api`
- Uses SQLite database by default (`backend/dev.sqlite`)

#### 4. **Start Backend Server (Dev Mode)**
Run backend with nodemon for auto-restart on file changes.
- Task name: `Start Backend Server (Dev Mode)`
- Great for development

#### 5. **Start Frontend (Expo)**
Run only the frontend Expo development server.
- Task name: `Start Frontend (Expo)`
- After starting, press `a` for Android or scan QR code with Expo Go

#### 6. **Start Frontend (Android)**
Automatically starts Expo and opens in Android emulator.
- Task name: `Start Frontend (Android)`
- Requires Android emulator to be running or configured

#### 7. **Install Backend Dependencies**
Install only backend dependencies.
- Task name: `Install Backend Dependencies`

#### 8. **Install Frontend Dependencies**
Install only frontend dependencies.
- Task name: `Install Frontend Dependencies`

## Step-by-Step: Running the Full Application

### Using the Default Build Task (Easiest)

1. Open the project in VSCode
2. Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
3. This will automatically start both backend and frontend
4. Wait for both servers to start:
   - Backend: Look for "Server running" or "listening" message
   - Frontend: Look for Expo QR code and Metro bundler ready
5. Press `a` in the frontend terminal to open Android, or scan QR code with Expo Go

### Using the Command Palette

1. Open VSCode
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Tasks: Run Task"
4. First time: Select `Install All Dependencies` and wait for completion
5. Then select `Run Full Stack (Backend + Frontend)`

### Manual Terminal Commands

If you prefer running commands manually in VSCode's integrated terminal:

#### Terminal 1 - Backend:
```bash
cd backend
npm install
npm run start
```

#### Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm start
# Then press 'a' for Android
```

## Debugging

Launch configurations are available in the Debug panel (Ctrl+Shift+D):

1. **Debug Backend** - Debug the backend server
2. **Debug Backend (Dev Mode)** - Debug with nodemon auto-restart

To use:
1. Open the Debug panel (`Ctrl+Shift+D` or `Cmd+Shift+D`)
2. Select a configuration from the dropdown
3. Press F5 or click the green play button

## Android Emulator Networking

The frontend is configured to connect to the backend from Android emulator:
- API endpoint: `http://10.0.2.2:5000/api`
- Socket.IO: `http://10.0.2.2:5000`

The address `10.0.2.2` is Android emulator's special alias to reach the host machine's localhost.

## Troubleshooting

### Backend won't start
- Check if port 5000 is already in use
- Run `Install Backend Dependencies` task first
- Check `backend/dev.sqlite` is created (SQLite database)

### Frontend won't start
- Ensure Node.js 20+ is installed
- Run `Install Frontend Dependencies` task first
- Close and restart Expo if it's stuck

### Cannot connect to backend from mobile app
- Ensure backend is running on port 5000
- If using physical device, you may need to update API URLs in frontend code
- For emulator, the `10.0.2.2` address should work automatically

### Expo QR code won't scan
- Make sure your phone and computer are on the same network
- Try pressing `a` to open Android emulator instead
- Or use tunnel mode: `npx expo start --tunnel`

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Sequelize Documentation](https://sequelize.org/)

## Database Configuration

By default, the backend uses SQLite for easy local development. To use PostgreSQL:

1. Create a `.env` file in the `backend` directory
2. Add your database configuration:
```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flickx
DB_USER=your_username
DB_PASSWORD=your_password
```

## Project Structure

```
movie-recommendation-system/
├── backend/          # Node.js/Express API
│   ├── src/         # Backend source code
│   └── package.json
├── frontend/        # React Native/Expo app
│   ├── app/         # App routes (Expo Router)
│   ├── components/  # Reusable components
│   ├── screens/     # Screen components
│   └── package.json
├── ai/              # AI/ML module
└── .vscode/         # VSCode configuration
    ├── tasks.json   # Task definitions
    └── launch.json  # Debug configurations
```
