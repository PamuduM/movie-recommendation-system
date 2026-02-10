const { Op } = require('sequelize');
const { Chat, User, Follow } = require('../models');

exports.getChatsByUser = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const chats = await Chat.findAll({
      where: {
        [Op.or]: [{ senderId: requestedUserId }, { receiverId: requestedUserId }],
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'avatar'] },
      ],
      order: [['createdAt', 'ASC']]
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message, isAI } = req.body;

    const parsedReceiverId = Number(receiverId);
    if (!Number.isInteger(parsedReceiverId)) {
      return res.status(400).json({ error: 'Invalid receiverId' });
    }
    if (parsedReceiverId === req.user.id) {
      return res.status(400).json({ error: 'You cannot chat with yourself' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!Boolean(isAI)) {
      const [followsA, followsB] = await Promise.all([
        Follow.findOne({ where: { followerId: req.user.id, followingId: parsedReceiverId } }),
        Follow.findOne({ where: { followerId: parsedReceiverId, followingId: req.user.id } }),
      ]);
      if (!followsA || !followsB) {
        return res.status(403).json({ error: 'Follow each other to chat' });
      }
    }

    const chat = await Chat.create({
      senderId: req.user.id,
      receiverId: parsedReceiverId,
      message: message.trim(),
      isAI: Boolean(isAI),
    });
    res.status(201).json(chat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
