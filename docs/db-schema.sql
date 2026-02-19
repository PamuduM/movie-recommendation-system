-- Chats
CREATE TABLE `Chats` (`id` INTEGER PRIMARY KEY, `senderId` INTEGER NOT NULL REFERENCES `Users` (`id`), `receiverId` INTEGER NOT NULL REFERENCES `Users` (`id`), `message` TEXT NOT NULL, `isAI` TINYINT(1) DEFAULT 0, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Favorites
CREATE TABLE `Favorites` (`id` INTEGER PRIMARY KEY, `userId` INTEGER NOT NULL REFERENCES `Users` (`id`), `movieId` INTEGER NOT NULL REFERENCES `Movies` (`id`), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Follows
CREATE TABLE `Follows` (`id` INTEGER PRIMARY KEY, `followerId` INTEGER NOT NULL UNIQUE REFERENCES `Users` (`id`), `followingId` INTEGER NOT NULL UNIQUE REFERENCES `Users` (`id`), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Movies
CREATE TABLE `Movies` (`id` INTEGER PRIMARY KEY, `title` VARCHAR(255) NOT NULL, `description` TEXT, `releaseDate` DATETIME, `poster` VARCHAR(255), `genres` JSON DEFAULT '[]', `trailerUrl` VARCHAR(255), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Notifications
CREATE TABLE `Notifications` (`id` INTEGER PRIMARY KEY, `userId` INTEGER NOT NULL REFERENCES `Users` (`id`), `type` VARCHAR(255) NOT NULL, `message` VARCHAR(255) NOT NULL, `read` TINYINT(1) DEFAULT 0, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Reviews
CREATE TABLE `Reviews` (`id` INTEGER PRIMARY KEY, `userId` INTEGER NOT NULL REFERENCES `Users` (`id`), `movieId` INTEGER NOT NULL REFERENCES `Movies` (`id`), `rating` FLOAT NOT NULL, `comment` TEXT, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);

-- Users
CREATE TABLE `Users` (`id` INTEGER PRIMARY KEY, `username` VARCHAR(255) NOT NULL UNIQUE, `email` VARCHAR(255) NOT NULL UNIQUE, `password` VARCHAR(255) NOT NULL, `avatar` VARCHAR(255), `bio` TEXT, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `emailVerified` TINYINT(1) DEFAULT 0, `emailVerificationToken` VARCHAR(255), `emailVerificationExpires` DATETIME, `passwordResetToken` VARCHAR(255), `passwordResetExpires` DATETIME);

-- Watchlists
CREATE TABLE `Watchlists` (`id` INTEGER PRIMARY KEY, `userId` INTEGER NOT NULL REFERENCES `Users` (`id`), `movieId` INTEGER NOT NULL REFERENCES `Movies` (`id`), `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL);
