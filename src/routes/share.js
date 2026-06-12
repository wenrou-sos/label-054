const express = require('express');
const { AchievementShare } = require('../models');
const { shareSchemas, paginationSchema } = require('../middleware/validation');
const { authenticate, optionalAuth } = require('../middleware');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/token/:token', optionalAuth, async (req, res, next) => {
  try {
    const share = await AchievementShare.getShareByToken(
      req.params.token,
      req.player?.id
    );

    await AchievementShare.incrementView(req.params.token);

    res.json({
      success: true,
      data: {
        ...share.toJSON(),
        player: share.player?.toPublicJSON(),
        achievement: share.achievement?.toJSON()
      }
    });
  } catch (error) {
    if (error.message === 'SHARE_NOT_FOUND') {
      return next(new AppError('SHARE_NOT_FOUND'));
    }
    if (error.message === 'SHARE_EXPIRED') {
      return next(new AppError('SHARE_EXPIRED'));
    }
    if (error.message === 'SHARE_NOT_AUTHORIZED') {
      return next(new AppError('SHARE_NOT_AUTHORIZED'));
    }
    next(error);
  }
});

router.get('/player/me', authenticate, shareSchemas.list, async (req, res, next) => {
  try {
    const result = await AchievementShare.getPlayerShares(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/player/:playerId', optionalAuth, shareSchemas.list, async (req, res, next) => {
  try {
    const options = {
      ...req.query,
      visibility: req.player?.id === parseInt(req.params.playerId, 10)
        ? req.query.visibility
        : 'public'
    };

    const result = await AchievementShare.getPlayerShares(
      parseInt(req.params.playerId, 10),
      options
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/token/:token/like', authenticate, async (req, res, next) => {
  try {
    await AchievementShare.incrementLike(req.params.token);
    res.json({
      success: true,
      message: '点赞成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
