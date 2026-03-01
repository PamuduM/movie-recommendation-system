const { Op } = require('sequelize');
const { Chat, User, Follow } = require('../models');

const ensureMutualFollow = async (userId, otherUserId) => {
  if (!Number.isInteger(userId) || !Number.isInteger(otherUserId) || userId === otherUserId) {
    return false;
  }

  const [followsA, followsB] = await Promise.all([
    Follow.findOne({ where: { followerId: userId, followingId: otherUserId } }),
    Follow.findOne({ where: { followerId: otherUserId, followingId: userId } }),
  ]);

  return Boolean(followsA && followsB);
};

exports.getChatsByUser = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const partnerParam = req.query.with;
    let whereClause = {
      [Op.or]: [{ senderId: requestedUserId }, { receiverId: requestedUserId }],
    };

    if (partnerParam !== undefined) {
      const partnerId = Number(partnerParam);
      if (!Number.isInteger(partnerId)) {
        return res.status(400).json({ error: 'Invalid chat partner id' });
      }
      if (partnerId === requestedUserId) {
        return res.status(400).json({ error: 'You cannot chat with yourself' });
      }

      const mutual = await ensureMutualFollow(requestedUserId, partnerId);
      if (!mutual) {
        return res.status(403).json({ error: 'Follow each other to chat' });
      }

      whereClause = {
        [Op.or]: [
          { senderId: requestedUserId, receiverId: partnerId },
          { senderId: partnerId, receiverId: requestedUserId },
        ],
      };
    }

    const chats = await Chat.findAll({
      where: whereClause,
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
      const mutual = await ensureMutualFollow(req.user.id, parsedReceiverId);
      if (!mutual) {
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

exports.getChatContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const searchQuery = String(req.query.q || '').trim().toLowerCase();

    const [following, followers] = await Promise.all([
      Follow.findAll({ where: { followerId: userId }, attributes: ['followingId'] }),
      Follow.findAll({ where: { followingId: userId }, attributes: ['followerId'] }),
    ]);

    const followerSet = new Set(followers.map((item) => item.followerId));
    const mutualIds = following
      .map((item) => item.followingId)
      .filter((id) => followerSet.has(id));

    if (!mutualIds.length) {
      return res.json([]);
    }

    const [users, recentChats] = await Promise.all([
      User.findAll({
        where: { id: mutualIds },
        attributes: ['id', 'username', 'avatar', 'bio'],
      }),
      Chat.findAll({
        where: {
          [Op.or]: [
            { senderId: userId, receiverId: { [Op.in]: mutualIds } },
            { receiverId: userId, senderId: { [Op.in]: mutualIds } },
          ],
        },
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const lastMessageMap = new Map();
    for (const chat of recentChats) {
      const partnerId = chat.senderId === userId ? chat.receiverId : chat.senderId;
      if (!lastMessageMap.has(partnerId)) {
        lastMessageMap.set(partnerId, chat);
      }
    }

    const contacts = users
      .map((profile) => {
        const lastChat = lastMessageMap.get(profile.id);
        return {
          id: profile.id,
          username: profile.username,
          avatar: profile.avatar,
          bio: profile.bio,
          lastMessage: lastChat ? lastChat.message : null,
          lastMessageAt: lastChat ? lastChat.createdAt : null,
        };
      })
      .filter((contact) => {
        if (!searchQuery) return true;
        return contact.username.toLowerCase().includes(searchQuery);
      })
      .sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });

    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
