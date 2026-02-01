# FlickX Backend

Production-ready Node.js (Express) REST API for FlickX.

## Features
- Modular structure (controllers, models, routes, middleware, services, config, utils)
- PostgreSQL with Sequelize ORM
- JWT authentication
- Input validation and security middleware
- Real-time chat (Socket.IO)
- Ready for AI module integration

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure your `.env` file (see `.env` example).
3. Start the server:
   ```bash
   npm run dev
   ```

## Folder Structure
- `src/models` - Sequelize models
- `src/controllers` - Route controllers
- `src/routes` - Express routes
- `src/middleware` - Auth and validation middleware
- `src/services` - Business logic
- `src/config` - Database and config
- `src/utils` - Utility functions
