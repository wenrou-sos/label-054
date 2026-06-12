const { Op } = require('sequelize');
const { Player, Friendship } = require('../models');
const { AppError } = require('../middleware');
const logger = require('../config/logger');

class PlayerService {
  async register(playerData) {
    const { username, email } = playerData;

    const existingUsername = await Player.findOne({ where: { username } });
    if (existingUsername) {
      throw new AppError('USERNAME_EXISTS');
    }

    const existingEmail = await Player.findOne({ where: { email } });
    if (existingEmail) {
      throw new AppError('EMAIL_EXISTS');
    }

    const player = await Player.create(playerData);
    logger.info(`新玩家注册: ${player.username} (ID: ${player.id})`);

    return player;
  }

  async login(username, password) {
    const player = await Player.findOne({
      where: {
        [Op.or]: [{ username }, { email: username }]
      }
    });

    if (!player) {
      throw new AppError('INVALID_CREDENTIALS');
    }

    if (player.bannedAt) {
      throw new AppError('PLAYER_BANNED');
    }

    const isValidPassword = await player.comparePassword(password);
    if (!isValidPassword) {
      throw new AppError('INVALID_CREDENTIALS');
    }

    await player.update({ lastActiveAt: new Date(), status: 'online' });
    logger.info(`玩家登录: ${player.username} (ID: ${player.id})`);

    return player;
  }

  async getById(playerId) {
    const player = await Player.findByPk(playerId);
    if (!player) {
      throw new AppError('PLAYER_NOT_FOUND');
    }
    return player;
  }

  async getProfile(playerId, viewerId = null) {
    const player = await this.getById(playerId);

    const profile = player.toJSON();

    if (viewerId && viewerId !== playerId) {
      const relation = await Friendship.getRelationLevel(viewerId, playerId);
      profile.relationLevel = relation;

      if (!player.preferences?.showAchievements) {
        delete profile.stats;
      }

      if (!player.preferences?.showOnlineStatus) {
        profile.status = 'offline';
      }
    }

    return profile;
  }

  async updateProfile(playerId, updateData) {
    const player = await this.getById(playerId);

    if (updateData.preferences) {
      updateData.preferences = {
        ...player.preferences,
        ...updateData.preferences
      };
    }

    await player.update(updateData);
    logger.info(`玩家资料更新: ${player.username} (ID: ${player.id})`);

    return player;
  }

  async searchPlayers(query, options = {}) {
    const { page = 1, limit = 20, excludeIds = [] } = options;

    if (!query || query.trim().length < 1) {
      return {
        players: [],
        pagination: { page, limit, total: 0, pages: 0 }
      };
    }

    const result = await Player.searchPlayers(query, { page, limit, excludeIds });

    return result;
  }

  async updateStats(playerId, statsData) {
    const player = await this.getById(playerId);

    const updatedStats = { ...player.stats };
    Object.keys(statsData).forEach(key => {
      if (typeof updatedStats[key] === 'number' && typeof statsData[key] === 'number') {
        updatedStats[key] += statsData[key];
      }
    });

    await player.update({ stats: updatedStats });

    return updatedStats;
  }

  async updateLastActive(playerId) {
    return Player.update(
      { lastActiveAt: new Date() },
      { where: { id: playerId } }
    );
  }

  async updateStatus(playerId, status) {
    return Player.update(
      { status },
      { where: { id: playerId } }
    );
  }

  async banPlayer(playerId, reason = '') {
    const player = await this.getById(playerId);

    if (player.isAdmin) {
      throw new AppError('FORBIDDEN', { message: '无法封禁管理员' });
    }

    await player.update({
      bannedAt: new Date(),
      banReason: reason,
      status: 'offline'
    });

    logger.warn(`玩家被封禁: ${player.username} (ID: ${player.id}), 原因: ${reason}`);

    return player;
  }

  async unbanPlayer(playerId) {
    const player = await this.getById(playerId);

    await player.update({
      bannedAt: null,
      banReason: null
    });

    logger.info(`玩家被解封: ${player.username} (ID: ${player.id})`);

    return player;
  }

  async listPlayers(options = {}) {
    const {
      page = 1,
      limit = 50,
      status,
      isBanned,
      minLevel,
      maxLevel
    } = options;
    const offset = (page - 1) * limit;

    const where = {};

    if (status) where.status = status;
    if (isBanned === true) where.bannedAt = { [Op.ne]: null };
    if (isBanned === false) where.bannedAt = null;
    if (minLevel) where.level = { ...where.level, [Op.gte]: minLevel };
    if (maxLevel) where.level = { ...where.level, [Op.lte]: maxLevel };

    const { count, rows } = await Player.findAndCountAll({
      where,
      limit,
      offset,
      attributes: { exclude: ['password', 'email'] },
      order: [['level', 'DESC'], ['username', 'ASC']]
    });

    return {
      players: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }
}

module.exports = new PlayerService();
