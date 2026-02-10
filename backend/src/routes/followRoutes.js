const express = require('express');
const followController = require('../controllers/followController');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/followers/:userId', auth, followController.getFollowers);
router.get('/following/:userId', auth, followController.getFollowing);
router.post('/:userId', auth, followController.followUser);
router.delete('/:userId', auth, followController.unfollowUser);

module.exports = router;
