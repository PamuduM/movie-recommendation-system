const express = require('express');
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/contacts', auth, chatController.getChatContacts);
router.get('/:userId', auth, chatController.getChatsByUser);
router.post('/', auth, chatController.sendMessage);

module.exports = router;
