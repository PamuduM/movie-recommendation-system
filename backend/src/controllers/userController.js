const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const isDev = process.env.NODE_ENV !== 'production';

const createToken = () => crypto.randomBytes(32).toString('hex');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'Email already in use' });
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(409).json({ error: 'Username already in use' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailVerificationToken = createToken();
    const emailVerificationExpires = new Date(Date.now() + ONE_DAY_MS);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const response = {
      message: 'User registered',
      token,
      user: {
        id: user.id,
        username,
        email,
        emailVerified: false,
        avatar: user.avatar,
        bio: user.bio,
      },
    };
    if (isDev) response.verificationToken = emailVerificationToken;
    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'avatar', 'bio', 'emailVerified'],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, email, avatar, bio } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) return res.status(409).json({ error: 'Username already in use' });
      user.username = username;
    }

    let verificationToken;
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) return res.status(409).json({ error: 'Email already in use' });
      user.email = email;
      user.emailVerified = false;
      verificationToken = createToken();
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + ONE_DAY_MS);
    }

    if (typeof avatar !== 'undefined') user.avatar = avatar;
    if (typeof bio !== 'undefined') user.bio = bio;

    await user.save();

    const response = {
      message: 'Profile updated',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified,
      },
    };
    if (isDev && verificationToken) response.verificationToken = verificationToken;
    res.json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: 'If the email exists, a reset link has been sent.' });

    const resetToken = createToken();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + ONE_HOUR_MS);
    await user.save();

    const response = { message: 'If the email exists, a reset link has been sent.' };
    if (isDev) response.resetToken = resetToken;
    res.json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.requestEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: 'If the email exists, a verification link has been sent.' });
    if (user.emailVerified) return res.json({ message: 'Email already verified.' });

    const verificationToken = createToken();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + ONE_DAY_MS);
    await user.save();

    const response = { message: 'If the email exists, a verification link has been sent.' };
    if (isDev) response.verificationToken = verificationToken;
    res.json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const dialect = User.sequelize.getDialect();
    const op = dialect === 'postgres' ? Op.iLike : Op.like;

    const users = await User.findAll({
      where: {
        username: { [op]: `%${q}%` },
        id: { [Op.ne]: req.user.id },
      },
      attributes: ['id', 'username', 'avatar', 'bio'],
      limit: 20,
      order: [['username', 'ASC']],
    });

    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
