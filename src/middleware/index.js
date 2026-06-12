const { AppError, errorHandler, notFoundHandler } = require('./errorHandler');
const { authenticate, requireAdmin, optionalAuth, logout, generateToken } = require('./auth');
const { cache, invalidateCache, clearCache } = require('./cache');
const { apiLimiter, authLimiter, friendRequestLimiter, achievementEventLimiter } = require('./rateLimiter');

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  authenticate,
  requireAdmin,
  optionalAuth,
  logout,
  generateToken,
  cache,
  invalidateCache,
  clearCache,
  apiLimiter,
  authLimiter,
  friendRequestLimiter,
  achievementEventLimiter
};
