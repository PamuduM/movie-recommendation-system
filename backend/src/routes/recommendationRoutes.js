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

router.post('/mood', async (req, res) => {
  try {
    const payload = req.body || {};
    const data = await aiRecommendationService.getMoodRecommendations(payload);
    res.json({
      mood: data.mood,
      recommendations: data.recommendations,
      meta: data.meta,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
