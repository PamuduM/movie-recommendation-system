const { Notification, Follow, User } = require('../models');

const FOLLOW_NOTIFICATION_SUFFIX = 'started following you.';

const normalizeFollowNotifications = async (requestedUserId, notifications) => {
  const followNotifications = notifications.filter((item) => item.type === 'follow');
  if (!followNotifications.length) return notifications;

  const follows = await Follow.findAll({
    where: { followingId: requestedUserId },
    include: [{ model: User, as: 'follower', attributes: ['username'] }],
    order: [['createdAt', 'ASC']],
  });

  if (!follows.length) return notifications;

  const availableFollows = follows.slice();
  const pickClosestFollow = (timestamp) => {
    if (!availableFollows.length) return null;
    let bestIndex = 0;
    let bestDiff = Infinity;
    for (let index = 0; index < availableFollows.length; index += 1) {
      const followTime = new Date(availableFollows[index].createdAt).getTime();
      const diff = Math.abs(followTime - timestamp);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    }
    const [match] = availableFollows.splice(bestIndex, 1);
    return match;
  };

  return notifications.map((notification) => {
    if (notification.type !== 'follow') return notification;
    const createdAtValue = new Date(notification.createdAt).getTime();
    if (Number.isNaN(createdAtValue)) return notification;

    const closestFollow = pickClosestFollow(createdAtValue);
    const followerName = closestFollow?.follower?.username;
    if (!followerName) return notification;

    const currentMessage = String(notification.message || '').trim();
    if (currentMessage.endsWith(FOLLOW_NOTIFICATION_SUFFIX) && currentMessage.startsWith(`${followerName} `)) {
      return notification;
    }

    return {
      ...notification,
      message: `${followerName} ${FOLLOW_NOTIFICATION_SUFFIX}`,
    };
  });
};

exports.getNotificationsByUser = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId);
    if (!Number.isInteger(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (requestedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const notifications = await Notification.findAll({
      where: { userId: requestedUserId },
      order: [['createdAt', 'DESC']]
    });

    const plainNotifications = notifications.map((entry) => entry.get({ plain: true }));
    const normalized = await normalizeFollowNotifications(requestedUserId, plainNotifications);
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { userId, type, message } = req.body;
    const targetUserId = userId == null ? req.user.id : Number(userId);
    if (!Number.isInteger(targetUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!type || !message) {
      return res.status(400).json({ error: 'type and message are required' });
    }

    const notification = await Notification.create({ userId: targetUserId, type, message });
    res.status(201).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
