const { Op } = require('sequelize');
const { Achievement, PlayerAchievement, Player, Friendship } = require('../models');
const { AppError } = require('../middleware');
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

class AchievementService {
  async createAchievement(achievementData) {
    const existing = await Achievement.findOne({
      where: { code: achievementData.code }
    });

    if (existing) {
      throw new AppError('ACHIEVEMENT_CODE_EXISTS');
    }

    const achievement = await Achievement.create(achievementData);

    logger.info('成就已创建', { achievementId: achievement.id, code: achievement.code });

    return achievement;
  }

  async updateAchievement(achievementId, updateData) {
    const achievement = await Achievement.findByPk(achievementId);

    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    const updated = await achievement.update(updateData);

    logger.info('成就已更新', { achievementId });

    return updated;
  }

  async deleteAchievement(achievementId) {
    const achievement = await Achievement.findByPk(achievementId);

    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    await achievement.destroy();

    logger.info('成就已删除', { achievementId });

    return { success: true };
  }

  async getAchievementById(achievementId) {
    const achievement = await Achievement.findByPk(achievementId);

    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    return achievement;
  }

  async getAchievementByCode(code) {
    const achievement = await Achievement.findByCode(code);

    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    return achievement;
  }

  async listAchievements(options = {}) {
    return Achievement.getActiveAchievements(options);
  }

  async getPlayerAchievements(playerId, options = {}) {
    return PlayerAchievement.getPlayerAchievements(playerId, options);
  }

  async getPlayerAchievementStats(playerId) {
    return PlayerAchievement.getStats(playerId);
  }

  async trackEvent(playerId, eventName, value = 1, metadata = {}) {
    const t = await sequelize.transaction();

    try {
      const achievements = await Achievement.getByEvent(eventName);

      if (achievements.length === 0) {
        await t.commit();
        return { unlocked: [], progress: [] };
      }

      const unlockedAchievements = [];
      const progressUpdates = [];

      for (const achievement of achievements) {
        const playerAchievement = await PlayerAchievement.updateProgress(
          playerId,
          achievement,
          value,
          t
        );

        const progressData = {
          achievementId: achievement.id,
          achievementCode: achievement.code,
          achievementName: achievement.name,
          progress: playerAchievement.progress,
          currentValue: playerAchievement.currentValue,
          targetValue: playerAchievement.targetValue,
          isUnlocked: playerAchievement.isUnlocked
        };

        if (playerAchievement.isUnlocked && !playerAchievement.previousIsUnlocked) {
          unlockedAchievements.push({
            ...progressData,
            unlockedAt: playerAchievement.unlockedAt,
            points: achievement.points,
            rewards: achievement.rewards
          });

          if (achievement.rewards?.experience > 0) {
            const { playerService } = require('./index');
            await playerService.updateExperience(playerId, achievement.rewards.experience);
          }

          this.trackEvent(playerId, 'achievement_unlocked', 1, { achievementId: achievement.id });
        }

        progressUpdates.push(progressData);
      }

      await t.commit();

      if (unlockedAchievements.length > 0) {
        logger.info('成就已解锁', {
          playerId,
          event: eventName,
          count: unlockedAchievements.length
        });
      }

      return {
        unlocked: unlockedAchievements,
        progress: progressUpdates
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async unlockAchievement(playerId, achievementCode) {
    const achievement = await Achievement.findByCode(achievementCode);

    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    const t = await sequelize.transaction();

    try {
      let playerAchievement = await PlayerAchievement.findOne({
        where: { playerId, achievementId: achievement.id },
        transaction: t
      });

      if (playerAchievement?.isUnlocked) {
        await t.commit();
        throw new AppError('ACHIEVEMENT_ALREADY_UNLOCKED');
      }

      const config = achievement.conditionConfig || {};
      const target = config.target || 1;

      if (!playerAchievement) {
        playerAchievement = await PlayerAchievement.create({
          playerId,
          achievementId: achievement.id,
          targetValue: target,
          currentValue: target,
          progress: 100,
          isUnlocked: true,
          unlockedAt: new Date()
        }, { transaction: t });
      } else {
        playerAchievement = await playerAchievement.update({
          currentValue: target,
          progress: 100,
          isUnlocked: true,
          unlockedAt: new Date()
        }, { transaction: t });
      }

      await achievement.increment('unlockCount', { transaction: t });

      if (achievement.rewards?.experience > 0) {
        const { playerService } = require('./index');
        await playerService.updateExperience(playerId, achievement.rewards.experience);
      }

      await t.commit();

      logger.info('成就手动解锁', { playerId, achievementId: achievement.id });

      this.trackEvent(playerId, 'achievement_unlocked', 1, { achievementId: achievement.id });

      return {
        achievement,
        playerAchievement
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async markAchievementSeen(playerId, achievementId) {
    const playerAchievement = await PlayerAchievement.findOne({
      where: { playerId, achievementId }
    });

    if (!playerAchievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    return playerAchievement.update({
      isSeen: true,
      seenAt: new Date()
    });
  }

  async getUnseenAchievements(playerId) {
    const achievements = await PlayerAchievement.findAll({
      where: {
        playerId,
        isUnlocked: true,
        isSeen: false
      },
      include: [{ association: 'achievement' }],
      order: [['unlocked_at', 'DESC']]
    });

    return achievements.map(pa => ({
      ...pa.achievement.toJSON(),
      unlockedAt: pa.unlockedAt
    }));
  }

  async compareWithFriend(playerId, friendId) {
    const friendship = await Friendship.findOne({
      where: {
        playerId,
        friendId,
        status: 'accepted'
      }
    });

    if (!friendship) {
      throw new AppError('FRIEND_NOT_FOUND');
    }

    return PlayerAchievement.compareWithFriend(playerId, friendId);
  }

  async getAchievementLeaderboard(achievementId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const achievement = await Achievement.findByPk(achievementId);
    if (!achievement) {
      throw new AppError('ACHIEVEMENT_NOT_FOUND');
    }

    const { count, rows } = await PlayerAchievement.findAndCountAll({
      where: {
        achievementId,
        isUnlocked: true
      },
      include: [{
        association: 'player',
        attributes: ['id', 'username', 'nickname', 'avatar', 'level']
      }],
      limit,
      offset,
      order: [['unlocked_at', 'ASC']]
    });

    return {
      achievement,
      leaderboard: rows.map((row, index) => ({
        rank: offset + index + 1,
        player: row.player.toPublicJSON(),
        unlockedAt: row.unlockedAt
      })),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }

  async getPlayerRank(playerId) {
    const stats = await PlayerAchievement.getStats(playerId);

    const player = await Player.findByPk(playerId, {
      attributes: ['id', 'username', 'nickname', 'avatar', 'level']
    });

    if (!player) {
      throw new AppError('PLAYER_NOT_FOUND');
    }

    const allPlayerStats = await PlayerAchievement.findAll({
      attributes: [
        'playerId',
        [sequelize.fn('SUM', sequelize.col('achievement.points')), 'total_points']
      ],
      include: [{
        association: 'achievement',
        attributes: []
      }],
      where: { isUnlocked: true },
      group: ['player_achievement.player_id'],
      order: [[sequelize.col('total_points'), 'DESC']],
      raw: true
    });

    const rank = allPlayerStats.findIndex(s => parseInt(s.playerId, 10) === playerId) + 1;

    return {
      player: player.toPublicJSON(),
      stats: stats.summary,
      rank,
      totalPlayers: allPlayerStats.length
    };
  }
}

module.exports = new AchievementService();
