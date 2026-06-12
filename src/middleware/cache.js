const cacheManager = require('../config/redis');
const logger = require('../config/logger');

const cache = (options = {}) => {
  const {
    ttl = 300,
    keyGenerator = (req) => `cache:${req.method}:${req.originalUrl}`,
    bypassOnQuery = false
  } = options;

  return async (req, res, next) => {
    if (bypassOnQuery && req.query.noCache === 'true') {
      return next();
    }

    const cacheKey = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : keyGenerator;

    try {
      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData !== null) {
        logger.debug(`缓存命中: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
    } catch (error) {
      logger.warn(`缓存读取失败: ${cacheKey}`, error);
    }

    res.sendResponse = res.json;
    res.json = (body) => {
      if (body && body.success && body.data) {
        cacheManager.set(cacheKey, body.data, ttl).catch(err => {
          logger.warn(`缓存写入失败: ${cacheKey}`, err);
        });
      }
      res.sendResponse(body);
    };

    res.locals.cacheKey = cacheKey;
    next();
  };
};

const invalidateCache = (pattern) => async (req, res, next) => {
  try {
    const cachePattern = typeof pattern === 'function'
      ? pattern(req)
      : pattern;

    if (cachePattern) {
      await cacheManager.delPattern(cachePattern);
      logger.debug(`缓存失效: ${cachePattern}`);
    }
  } catch (error) {
    logger.warn(`缓存失效失败: ${pattern}`, error);
  }
  next();
};

const clearCache = (req, res, next) => {
  if (res.locals.cacheKey) {
    cacheManager.del(res.locals.cacheKey).catch(err => {
      logger.warn(`清除缓存失败: ${res.locals.cacheKey}`, err);
    });
  }
  next();
};

module.exports = {
  cache,
  invalidateCache,
  clearCache
};
