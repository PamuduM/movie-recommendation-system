const { Follow, User, Notification } = require('../models');

exports.followUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const targetUser = await User.findByPk(targetUserId, { attributes: ['id'] });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const [follow, created] = await Follow.findOrCreate({
      where: { followerId: req.user.id, followingId: targetUserId },
    });

    if (created) {
      const follower = await User.findByPk(req.user.id, { attributes: ['username'] });
      const name = follower?.username ?? 'Someone';
      await Notification.create({
        userId: targetUserId,
        type: 'follow',
        message: `${name} started following you.`,
      });
    }

    res.json({ status: created ? 'followed' : 'already_following', followId: follow.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const removed = await Follow.destroy({
      where: { followerId: req.user.id, followingId: targetUserId },
    });

    res.json({ status: removed ? 'unfollowed' : 'not_following' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const followers = await Follow.findAll({
      where: { followingId: userId },
      include: [{ model: User, as: 'follower', attributes: ['id', 'username', 'avatar', 'bio'] }],
      order: [['createdAt', 'DESC']],
    });

    const list = followers.map((entry) => entry.follower).filter(Boolean);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const following = await Follow.findAll({
      where: { followerId: userId },
      include: [{ model: User, as: 'following', attributes: ['id', 'username', 'avatar', 'bio'] }],
      order: [['createdAt', 'DESC']],
    });

    const list = following.map((entry) => entry.following).filter(Boolean);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
