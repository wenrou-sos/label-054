const express = require('express');
const { playerService } = require('../services');
const { authSchemas } = require('../middleware/validation');
const { generateToken, authenticate, logout, authLimiter } = require('../middleware');
const cacheManager = require('../config/redis');

const router = express.Router();

router.post('/register', authSchemas.register, async (req, res, next) => {
  try {
    const player = await playerService.register(req.body);
    const token = generateToken(player);

    await cacheManager.set(`auth:token:${token}`, {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      avatar: player.avatar,
      level: player.level,
      isAdmin: player.isAdmin,
      status: player.status
    }, 300);

    res.status(201).json({
      success: true,
      data: {
        token,
        player: player.toJSON()
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authLimiter, authSchemas.login, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const player = await playerService.login(username, password);
    const token = generateToken(player);

    await cacheManager.set(`auth:token:${token}`, {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      avatar: player.avatar,
      level: player.level,
      isAdmin: player.isAdmin,
      status: player.status
    }, 300);

    res.json({
      success: true,
      data: {
        token,
        player: player.toJSON()
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, logout, (req, res) => {
  res.json({
    success: true,
    message: '登出成功'
  });
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await playerService.getProfile(req.player.id, req.player.id);
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
