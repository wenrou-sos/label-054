const express = require('express');
const { playerService } = require('../services');
const { playerSchemas, idParamSchema, paginationSchema } = require('../middleware/validation');
const { authenticate, optionalAuth, cache, invalidateCache } = require('../middleware');

const router = express.Router();

router.get('/search', optionalAuth, playerSchemas.search, async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;
    const excludeIds = req.player ? [req.player.id] : [];
    const result = await playerService.searchPlayers(q, { page, limit, excludeIds });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalAuth, idParamSchema, cache({
  keyGenerator: (req) => `player:profile:${req.params.id}:${req.player?.id || 'guest'}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const profile = await playerService.getProfile(
      parseInt(req.params.id, 10),
      req.player?.id
    );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, playerSchemas.update, invalidateCache((req) => `player:profile:${req.params.id}:*`), async (req, res, next) => {
  try {
    if (parseInt(req.params.id, 10) !== req.player.id && !req.player.isAdmin) {
      return next(new (require('../middleware').AppError)('FORBIDDEN'));
    }

    const player = await playerService.updateProfile(
      parseInt(req.params.id, 10),
      req.body
    );

    res.json({
      success: true,
      data: player.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    if (parseInt(req.params.id, 10) !== req.player.id) {
      return next(new (require('../middleware').AppError)('FORBIDDEN'));
    }

    const { status } = req.body;
    await playerService.updateStatus(parseInt(req.params.id, 10), status);

    res.json({
      success: true,
      message: '状态已更新'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
