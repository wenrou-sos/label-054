const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config');
const { AppError } = require('./errorHandler');

let redisClient = null;

if (config.env !== 'test') {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  });
}

const createLimiter = (options = {}) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.max,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req) => req.ip
  } = options;

  const store = redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: 'rate_limit:'
  }) : undefined;

  return rateLimit({
    windowMs,
    max,
    store,
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
