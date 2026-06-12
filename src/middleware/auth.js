const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('./errorHandler');
const { Player } = require('../models');
const cacheManager = require('../config/redis');

const generateToken = (player) => {
  return jwt.sign(
    {
      id: player.id,
      username: player.username,
      isAdmin: player.isAdmin
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];

    const cachedPlayer = await cacheManager.get(`auth:token:${token}`);
    if (cachedPlayer) {
      req.player = cachedPlayer;
      req.token = token;
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    const player = await Player.findByPk(decoded.id);

    if (!player) {
      return next(new AppError('UNAUTHORIZED'));
    }

    if (player.bannedAt) {
      return next(new AppError('PLAYER_BANNED'));
    }

    await player.update({ lastActiveAt: new Date() });

    const playerData = {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      avatar: player.avatar,
      level: player.level,
      isAdmin: player.isAdmin,
      status: player.status
    };

    await cacheManager.set(`auth:token:${token}`, playerData, 300);

    req.player = playerData;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  const adminApiKey = req.headers['x-admin-api-key'];

  if (adminApiKey === config.admin.apiKey) {
    req.adminAuthenticated = true;
    return next();
  }

  if (req.player && req.player.isAdmin) {
    return next();
  }

  next(new AppError('ADMIN_REQUIRED'));
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const player = await Player.findByPk(decoded.id);

    if (player && !player.bannedAt) {
      req.player = {
        id: player.id,
        username: player.username,
        nickname: player.nickname,
        avatar: player.avatar,
        level: player.level,
        isAdmin: player.isAdmin
      };
    }

    next();
  } catch (error) {
    next();
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.token) {
      await cacheManager.del(`auth:token:${req.token}`);
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateToken,
  authenticate,
  requireAdmin,
  optionalAuth,
  logout
};
