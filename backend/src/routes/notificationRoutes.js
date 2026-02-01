const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const router = express.Router();

router.get('/:userId', auth, notificationController.getNotificationsByUser);
router.post('/', auth, [
	body('userId').optional().isInt(),
	body('type').notEmpty(),
	body('message').notEmpty(),
], validateRequest, notificationController.createNotification);
router.put('/:id/read', auth, notificationController.markAsRead);

module.exports = router;
