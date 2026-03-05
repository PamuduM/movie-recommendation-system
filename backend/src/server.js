const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
require('./models');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(helmet());
app.use(express.json());

// Import routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const movieRoutes = require('./routes/movieRoutes');
app.use('/api/movies', movieRoutes);

const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/reviews', reviewRoutes);

const watchlistRoutes = require('./routes/watchlistRoutes');
app.use('/api/watchlists', watchlistRoutes);

const favoriteRoutes = require('./routes/favoriteRoutes');
app.use('/api/favorites', favoriteRoutes);

const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chats', chatRoutes);

const recommendationRoutes = require('./routes/recommendationRoutes');
app.use('/api/recommendations', recommendationRoutes);

const searchRoutes = require('./routes/searchRoutes');
app.use('/api/search', searchRoutes);

const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const followRoutes = require('./routes/followRoutes');
app.use('/api/follows', followRoutes);

const tmdbRoutes = require('./routes/tmdbRoutes');
app.use('/api/tmdb', tmdbRoutes);

// Socket.IO setup with simple user registry to support private messages
const users = {}; // username -> socket.id

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user joined', (payload) => {
    const name = payload?.user || `u_${socket.id.slice(-4)}`;
    users[name] = socket.id;
    // broadcast updated user list
    io.emit('users', Object.keys(users));
    // announce join to everyone
    io.emit('user joined', { user: name });
  });

  socket.on('chat message', (msg) => {
    // msg may include optional `to` field (username)
    if (msg?.to && users[msg.to]) {
      // emit to recipient and sender only
      io.to(users[msg.to]).emit('chat message', msg);
      socket.emit('chat message', msg);
    } else {
      io.emit('chat message', msg);
    }
  });

  socket.on('disconnect', () => {
    // remove from users map
    const entry = Object.entries(users).find(([, id]) => id === socket.id);
    if (entry) {
      const [name] = entry;
      delete users[name];
      io.emit('users', Object.keys(users));
      io.emit('user joined', { user: `${name} left` });
    }
    console.log('User disconnected:', socket.id);
  });
});

const syncDatabase = async () => {
  const strategy = (process.env.DB_SYNC_STRATEGY || '').trim().toLowerCase();
  const shouldAlter = strategy === 'alter';
  const dialect = sequelize.getDialect();
  const syncOptions = shouldAlter ? { alter: true } : undefined;

  if (dialect === 'sqlite') {
    await sequelize.query('PRAGMA journal_mode = WAL;');
    await sequelize.query('PRAGMA busy_timeout = 10000;');
  }

  if (shouldAlter && dialect === 'sqlite') {
    console.warn('SQLite alter sync detected. Temporarily disabling foreign key checks.');
    await sequelize.query('PRAGMA foreign_keys = OFF;');
  }

  try {
    await sequelize.sync(syncOptions);
  } finally {
    if (shouldAlter && dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
  }
};

// Sync DB and start server
syncDatabase()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server (DB error):', err);
    process.exit(1);
  });
