#!/usr/bin/env node
/*
 * Seeds the SQLite development database with test users
 */
const path = require('path');
const bcrypt = require('bcryptjs');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const sequelize = require('../src/config/database');
require('../src/models');

const { User } = require('../src/models');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');

const TEST_USERS = [
  {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123', // Will be hashed
    emailVerified: true,
  },
  {
    username: 'john_doe',
    email: 'john@example.com',
    password: 'password456',
    emailVerified: true,
  },
  {
    username: 'jane_smith',
    email: 'jane@example.com',
    password: 'password789',
    emailVerified: true,
  },
];

const log = (msg) => console.log(`[SEED USERS] ${msg}`);

async function seedUsers() {
  try {
    await sequelize.sync();
    log('Database synced');

    // Check if users already exist
    let existingUsers = await User.findAll();
    
    if (existingUsers.length > 0 && !RESET) {
      log(`Found ${existingUsers.length} existing users:`);
      existingUsers.forEach(user => {
        log(`  - ${user.username} (${user.email})`);
      });
      log('Run with --reset flag to reset and reseed test users');
      return;
    }

    if (RESET && existingUsers.length > 0) {
      log(`Deleting ${existingUsers.length} existing users...`);
      await User.destroy({ where: {} });
      log('✓ All users deleted');
    }

    log('Creating test users...');
    for (const userData of TEST_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({
        ...userData,
        password: hashedPassword,
      });
      log(`✓ Created user: ${userData.email}`);
    }

    log('');
    log('User seeding complete!');
    log('Test credentials:');
    TEST_USERS.forEach(user => {
      log(`  Email: ${user.email}, Password: ${user.password}`);
    });
  } catch (err) {
    console.error('Error seeding users:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seedUsers();
