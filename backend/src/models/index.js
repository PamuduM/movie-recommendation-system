const User = require('./User');
const Movie = require('./Movie');
const Review = require('./Review');
const Watchlist = require('./Watchlist');
const Favorite = require('./Favorite');
const Chat = require('./Chat');
const Notification = require('./Notification');
const Follow = require('./Follow');

// Associations
User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

Movie.hasMany(Review, { foreignKey: 'movieId' });
Review.belongsTo(Movie, { foreignKey: 'movieId' });

User.hasMany(Watchlist, { foreignKey: 'userId' });
Watchlist.belongsTo(User, { foreignKey: 'userId' });
Movie.hasMany(Watchlist, { foreignKey: 'movieId' });
Watchlist.belongsTo(Movie, { foreignKey: 'movieId' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Favorite.belongsTo(User, { foreignKey: 'userId' });
Movie.hasMany(Favorite, { foreignKey: 'movieId' });
Favorite.belongsTo(Movie, { foreignKey: 'movieId' });

User.hasMany(Chat, { foreignKey: 'senderId', as: 'SentMessages' });
User.hasMany(Chat, { foreignKey: 'receiverId', as: 'ReceivedMessages' });

Chat.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Chat.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Follow, { foreignKey: 'followerId', as: 'Following' });
User.hasMany(Follow, { foreignKey: 'followingId', as: 'Followers' });
Follow.belongsTo(User, { foreignKey: 'followerId', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'followingId', as: 'following' });

module.exports = { User, Movie, Review, Watchlist, Favorite, Chat, Notification, Follow };
