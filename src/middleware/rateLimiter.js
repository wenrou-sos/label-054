const rateLimit = require('express-rate-limit');
const config = require('../config');
const { AppError } = require('./errorHandler');

const createLimiter = (options = {}) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.max,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req) => req.ip
  } = options;

  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    handler: (req, res, next) => {
      next(new AppError('RATE_LIMIT_EXCEEDED'));
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const apiLimiter = createLimiter({
  max: config.rateLimit.max,
  windowMs: config.rateLimit.windowMs
});

const authLimiter = createLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: '登录尝试次数过多，请15分钟后再试'
});

const friendRequestLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req) => `friend_request:${req.player?.id || req.ip}`
});

const achievementEventLimiter = createLimiter({
  max: 100,
  windowMs: 60 * 1000,
  keyGenerator: (req) => `achievement_event:${req.player?.id || req.ip}`
});

module.exports = {
  apiLimiter,
  authLimiter,
  friendRequestLimiter,
  achievementEventLimiter,
  createLimiter
};
