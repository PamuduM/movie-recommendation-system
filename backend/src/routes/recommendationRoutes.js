const express = require('express');
const aiRecommendationService = require('../services/aiRecommendationService');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/user/:userId', auth, async (req, res) => {
  try {
    const recommendations = await aiRecommendationService.getRecommendationsForUser(req.params.userId);
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
