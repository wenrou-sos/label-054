const express = require('express');
const { playerService, friendService } = require('../services');
const { paginationSchema, idParamSchema } = require('../middleware/validation');
const { authenticate, requireAdmin, cache, invalidateCache } = require('../middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/players', paginationSchema, cache({
  keyGenerator: (req) => `admin:players:${JSON.stringify(req.query)}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const result = await playerService.listPlayers(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/players/:id', idParamSchema, async (req, res, next) => {
  try {
    const player = await playerService.getById(parseInt(req.params.id, 10));
    res.json({
      success: true,
      data: player
    });
  } catch (error) {
    next(error);
  }
});

router.post('/players/:id/ban', idParamSchema, invalidateCache((req) => `player:profile:${req.params.id}:*`), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const player = await playerService.banPlayer(
      parseInt(req.params.id, 10),
      reason || ''
    );

    res.json({
      success: true,
      data: player.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/players/:id/unban', idParamSchema, invalidateCache((req) => `player:profile:${req.params.id}:*`), async (req, res, next) => {
  try {
    const player = await playerService.unbanPlayer(parseInt(req.params.id, 10));
    res.json({
      success: true,
      data: player.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cleanup/friend-requests', async (req, res, next) => {
  try {
    const count = await friendService.cleanupExpiredRequests();
    res.json({
      success: true,
      data: { cleanedCount: count }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const { Player, Friendship, Achievement, PlayerAchievement } = require('../models');
    const { sequelize } = require('../config/database');

    const [playerCount, friendCount, achievementCount, unlockedCount] = await Promise.all([
      Player.count(),
      Friendship.count({ where: { status: 'accepted' } }),
      Achievement.count({ where: { isActive: true } }),
      PlayerAchievement.count({ where: { isUnlocked: true } })
    ]);

    res.json({
      success: true,
      data: {
        totalPlayers: playerCount,
        totalFriendships: Math.floor(friendCount / 2),
        totalAchievements: achievementCount,
        totalUnlocks: unlockedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
