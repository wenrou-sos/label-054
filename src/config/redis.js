const Redis = require('ioredis');
const config = require('./index');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis连接成功');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis连接错误:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis连接关闭');
      });

    } catch (error) {
      logger.error('Redis初始化失败:', error);
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis获取失败 [${key}]:`, error);
      return null;
    }
  }

  async set(key, value, ttl = config.cache.ttl) {
    if (!this.isConnected) return false;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
      return true;
    } catch (error) {
      logger.error(`Redis设置失败 [${key}]:`, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis删除失败 [${key}]:`, error);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error(`Redis批量删除失败 [${pattern}]:`, error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) return false;
    try {
      return await this.client.exists(key) === 1;
    } catch (error) {
      logger.error(`Redis检查失败 [${key}]:`, error);
      return false;
    }
  }

  async incr(key, ttl = config.cache.ttl) {
    if (!this.isConnected) return null;
    try {
      const result = await this.client.incr(key);
      if (result === 1) {
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`Redis递增失败 [${key}]:`, error);
      return null;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}

const cacheManager = new CacheManager();

module.exports = cacheManager;
