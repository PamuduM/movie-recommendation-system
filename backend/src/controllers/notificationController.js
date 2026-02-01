const { Notification } = require('../models');

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
    res.json(notifications);
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
