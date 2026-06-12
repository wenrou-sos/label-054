const express = require('express');
const { achievementService } = require('../services');
const { AchievementShare } = require('../models');
const { achievementSchemas, idParamSchema, paginationSchema, shareSchemas } = require('../middleware/validation');
const { authenticate, optionalAuth, requireAdmin, achievementEventLimiter, cache, invalidateCache } = require('../middleware');

const router = express.Router();

router.get('/', optionalAuth, achievementSchemas.list, cache({
  keyGenerator: (req) => `achievements:list:${JSON.stringify(req.query)}`,
  ttl: 300
}), async (req, res, next) => {
  try {
    const result = await achievementService.listAchievements(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalAuth, idParamSchema, cache({
  keyGenerator: (req) => `achievement:${req.params.id}`,
  ttl: 300
}), async (req, res, next) => {
  try {
    const achievement = await achievementService.getAchievementById(
      parseInt(req.params.id, 10)
    );

    res.json({
      success: true,
      data: achievement
    });
  } catch (error) {
    next(error);
  }
});

router.get('/code/:code', optionalAuth, cache({
  keyGenerator: (req) => `achievement:code:${req.params.code}`,
  ttl: 300
}), async (req, res, next) => {
  try {
    const achievement = await achievementService.getAchievementByCode(req.params.code);
    res.json({
      success: true,
      data: achievement
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, requireAdmin, achievementSchemas.create, invalidateCache('achievements:list:*'), async (req, res, next) => {
  try {
    const achievement = await achievementService.createAchievement(req.body);
    res.status(201).json({
      success: true,
      data: achievement
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, requireAdmin, idParamSchema, achievementSchemas.update, invalidateCache([
  (req) => `achievements:list:*`,
  (req) => `achievement:${req.params.id}`,
  (req) => `achievement:code:*`
]), async (req, res, next) => {
  try {
    const achievement = await achievementService.updateAchievement(
      parseInt(req.params.id, 10),
      req.body
    );

    res.json({
      success: true,
      data: achievement
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, requireAdmin, idParamSchema, invalidateCache([
  (req) => `achievements:list:*`,
  (req) => `achievement:${req.params.id}`,
  (req) => `achievement:code:*`
]), async (req, res, next) => {
  try {
    const result = await achievementService.deleteAchievement(
      parseInt(req.params.id, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/track', authenticate, achievementEventLimiter, achievementSchemas.trackEvent, async (req, res, next) => {
  try {
    const { event, value, metadata } = req.body;
    const result = await achievementService.trackEvent(
      req.player.id,
      event,
      value,
      metadata
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unlock/:code', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await achievementService.unlockAchievement(
      req.player.id,
      req.params.code
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/me', authenticate, paginationSchema, cache({
  keyGenerator: (req) => `player:achievements:${req.player.id}:${JSON.stringify(req.query)}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const result = await achievementService.getPlayerAchievements(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/:playerId', optionalAuth, paginationSchema, cache({
  keyGenerator: (req) => `player:achievements:${req.params.playerId}:${JSON.stringify(req.query)}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const result = await achievementService.getPlayerAchievements(
      parseInt(req.params.playerId, 10),
      req.query
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/me/stats', authenticate, cache({
  keyGenerator: (req) => `player:achievement:stats:${req.player.id}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const stats = await achievementService.getPlayerAchievementStats(req.player.id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/:playerId/stats', optionalAuth, cache({
  keyGenerator: (req) => `player:achievement:stats:${req.params.playerId}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const stats = await achievementService.getPlayerAchievementStats(
      parseInt(req.params.playerId, 10)
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/me/unseen', authenticate, async (req, res, next) => {
  try {
    const achievements = await achievementService.getUnseenAchievements(req.player.id);
    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/seen', authenticate, idParamSchema, async (req, res, next) => {
  try {
    const result = await achievementService.markAchievementSeen(
      req.player.id,
      parseInt(req.params.id, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/compare/:friendId', authenticate, async (req, res, next) => {
  try {
    const result = await achievementService.compareWithFriend(
      req.player.id,
      parseInt(req.params.friendId, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/leaderboard', optionalAuth, idParamSchema, paginationSchema, cache({
  keyGenerator: (req) => `achievement:leaderboard:${req.params.id}:${JSON.stringify(req.query)}`,
  ttl: 300
}), async (req, res, next) => {
  try {
    const result = await achievementService.getAchievementLeaderboard(
      parseInt(req.params.id, 10),
      req.query
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/me/rank', authenticate, async (req, res, next) => {
  try {
    const result = await achievementService.getPlayerRank(req.player.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/share', authenticate, idParamSchema, shareSchemas.create, async (req, res, next) => {
  try {
    const { platform, message, visibility, expiresInDays } = req.body;
    const share = await AchievementShare.createShare(
      req.player.id,
      parseInt(req.params.id, 10),
      { platform, message, visibility, expiresInDays }
    );

    res.status(201).json({
      success: true,
      data: share
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
