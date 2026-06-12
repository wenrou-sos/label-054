const { DataTypes, Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');

const PlayerAchievement = sequelize.define('player_achievement', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  playerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'player',
      key: 'id'
    }
  },
  achievementId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'achievement',
      key: 'id'
    }
  },
  progress: {
    type: DataTypes.DOUBLE,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  currentValue: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  targetValue: {
    type: DataTypes.BIGINT,
    defaultValue: 1
  },
  isUnlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  unlockedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isSeen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  seenAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    {
      name: 'idx_player_achievement_unique',
      fields: ['player_id', 'achievement_id'],
      unique: true
    },
    {
      name: 'idx_player_achievement_player',
      fields: ['player_id', 'is_unlocked']
    },
    {
      name: 'idx_player_achievement_unlocked',
      fields: ['is_unlocked', 'unlocked_at']
    },
    {
      name: 'idx_player_achievement_achievement',
      fields: ['achievement_id', 'is_unlocked']
    }
  ]
});

PlayerAchievement.getPlayerAchievements = async function (playerId, options = {}) {
  const {
    isUnlocked,
    category,
    rarity,
    page = 1,
    limit = 50
  } = options;
  const offset = (page - 1) * limit;

  const where = {
    playerId,
    ...(typeof isUnlocked === 'boolean' && { isUnlocked })
  };

  const includeWhere = {
    isActive: true,
    ...(category && { category }),
    ...(rarity && { rarity })
  };

  const { count, rows } = await PlayerAchievement.findAndCountAll({
    where,
    include: [{
      association: 'achievement',
      where: includeWhere
    }],
    limit,
    offset,
    order: [
      ['is_unlocked', 'DESC'],
      ['unlocked_at', 'DESC'],
      ['progress', 'DESC']
    ]
  });

  return {
    achievements: rows.map(pa => ({
      ...pa.achievement.toJSON(),
      progress: pa.progress,
      currentValue: pa.currentValue,
      targetValue: pa.targetValue,
      isUnlocked: pa.isUnlocked,
      unlockedAt: pa.unlockedAt,
      isSeen: pa.isSeen
    })),
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

PlayerAchievement.getStats = async function (playerId) {
  const stats = await PlayerAchievement.findAll({
    where: { playerId },
    attributes: [
      'achievement.category',
      [literal('COUNT(*)'), 'total'],
      [literal('SUM(CASE WHEN is_unlocked THEN 1 ELSE 0 END)'), 'unlocked'],
      [literal('SUM(achievement.points * CASE WHEN is_unlocked THEN 1 ELSE 0 END)'), 'points']
    ],
    include: [{
      association: 'achievement',
      attributes: []
    }],
    group: ['achievement.category'],
    raw: true
  });

  const total = await PlayerAchievement.findOne({
    where: { playerId },
    attributes: [
      [literal('COUNT(*)'), 'total_achievements'],
      [literal('SUM(CASE WHEN is_unlocked THEN 1 ELSE 0 END)'), 'total_unlocked'],
      [literal('SUM(CASE WHEN is_unlocked THEN achievement.points ELSE 0 END)'), 'total_points']
    ],
    include: [{
      association: 'achievement',
      attributes: []
    }],
    raw: true
  });

  return {
    summary: {
      total: parseInt(total.total_achievements, 10) || 0,
      unlocked: parseInt(total.total_unlocked, 10) || 0,
      points: parseInt(total.total_points, 10) || 0,
      completionRate: total.total_achievements
        ? Math.round((total.total_unlocked / total.total_achievements) * 100)
        : 0
    },
    byCategory: stats.map(s => ({
      category: s.category,
      total: parseInt(s.total, 10),
      unlocked: parseInt(s.unlocked, 10),
      points: parseInt(s.points, 10),
      completionRate: s.total > 0 ? Math.round((s.unlocked / s.total) * 100) : 0
    }))
  };
};

PlayerAchievement.updateProgress = async function (playerId, achievement, value, transaction) {
  const config = achievement.conditionConfig || {};
  const target = config.target || 1;

  let playerAchievement = await PlayerAchievement.findOne({
    where: { playerId, achievementId: achievement.id },
    transaction,
    lock: true
  });

  if (!playerAchievement) {
    playerAchievement = await PlayerAchievement.create({
      playerId,
      achievementId: achievement.id,
      targetValue: target,
      currentValue: 0
    }, { transaction });
  }

  if (playerAchievement.isUnlocked) {
    return playerAchievement;
  }

  let newValue = playerAchievement.currentValue;

  switch (achievement.conditionType) {
    case 'boolean':
      newValue = value ? 1 : 0;
      break;
    case 'counter':
      newValue += value;
      break;
    case 'milestone':
    case 'progressive':
      newValue = Math.max(newValue, value);
      break;
    default:
      newValue = value;
  }

  const progress = achievement.getProgress(newValue);
  const isUnlocked = achievement.checkCondition(newValue);

  const updateData = {
    currentValue: newValue,
    progress,
    isUnlocked,
    unlockedAt: isUnlocked && !playerAchievement.isUnlocked ? new Date() : playerAchievement.unlockedAt
  };

  await playerAchievement.update(updateData, { transaction });

  if (isUnlocked && !playerAchievement.isUnlocked) {
    await achievement.increment('unlockCount', { transaction });
  }

  return playerAchievement;
};

PlayerAchievement.compareWithFriend = async function (playerId, friendId) {
  const query = `
    SELECT 
      a.id,
      a.code,
      a.name,
      a.description,
      a.category,
      a.rarity,
      a.points,
      pa1.is_unlocked as player_unlocked,
      pa1.unlocked_at as player_unlocked_at,
      pa1.progress as player_progress,
      pa1.current_value as player_current,
      pa2.is_unlocked as friend_unlocked,
      pa2.unlocked_at as friend_unlocked_at,
      pa2.progress as friend_progress,
      pa2.current_value as friend_current
    FROM achievement a
    LEFT JOIN player_achievement pa1 ON a.id = pa1.achievement_id AND pa1.player_id = ?
    LEFT JOIN player_achievement pa2 ON a.id = pa2.achievement_id AND pa2.player_id = ?
    WHERE a.is_active = true
      AND (a.starts_at IS NULL OR a.starts_at <= NOW())
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
    ORDER BY a.category, a.points DESC
  `;

  const [rows] = await sequelize.query(query, {
    replacements: [playerId, friendId],
    type: sequelize.QueryTypes.SELECT
  });

  const stats = {
    player: { unlocked: 0, total: 0, points: 0 },
    friend: { unlocked: 0, total: 0, points: 0 }
  };

  const achievements = rows.map(row => {
    if (row.player_unlocked) {
      stats.player.unlocked++;
      stats.player.points += row.points;
    }
    if (row.friend_unlocked) {
      stats.friend.unlocked++;
      stats.friend.points += row.points;
    }
    stats.player.total++;
    stats.friend.total++;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      rarity: row.rarity,
      points: row.points,
      player: {
        isUnlocked: row.player_unlocked,
        unlockedAt: row.player_unlocked_at,
        progress: parseFloat(row.player_progress) || 0,
        currentValue: parseInt(row.player_current, 10) || 0
      },
      friend: {
        isUnlocked: row.friend_unlocked,
        unlockedAt: row.friend_unlocked_at,
        progress: parseFloat(row.friend_progress) || 0,
        currentValue: parseInt(row.friend_current, 10) || 0
      },
      status: row.player_unlocked && row.friend_unlocked ? 'both'
        : row.player_unlocked ? 'player_only'
        : row.friend_unlocked ? 'friend_only'
        : 'none'
    };
  });

  return {
    achievements,
    stats: {
      player: {
        ...stats.player,
        completionRate: stats.player.total > 0
          ? Math.round((stats.player.unlocked / stats.player.total) * 100)
          : 0
      },
      friend: {
        ...stats.friend,
        completionRate: stats.friend.total > 0
          ? Math.round((stats.friend.unlocked / stats.friend.total) * 100)
          : 0
      },
      comparison: {
        playerAdvantage: stats.player.unlocked - stats.friend.unlocked,
        pointsDifference: stats.player.points - stats.friend.points,
        bothUnlocked: achievements.filter(a => a.status === 'both').length,
        playerOnly: achievements.filter(a => a.status === 'player_only').length,
        friendOnly: achievements.filter(a => a.status === 'friend_only').length,
        noneUnlocked: achievements.filter(a => a.status === 'none').length
      }
    }
  };
};

module.exports = PlayerAchievement;
