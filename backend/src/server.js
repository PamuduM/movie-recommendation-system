const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
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

// Socket.IO setup
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Sync DB and start server
sequelize
  .sync({ alter: true })
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
