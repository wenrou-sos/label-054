const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const AchievementShare = sequelize.define('achievement_share', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  shareToken: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true
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
  platform: {
    type: DataTypes.ENUM('internal', 'facebook', 'twitter', 'wechat', 'weibo', 'discord', 'other'),
    defaultValue: 'internal'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  visibility: {
    type: DataTypes.ENUM('public', 'friends', 'private'),
    defaultValue: 'friends'
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  expiresAt: {
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
      name: 'idx_achievement_share_token',
      fields: ['share_token'],
      unique: true
    },
    {
      name: 'idx_achievement_share_player',
      fields: ['player_id', 'visibility']
    },
    {
      name: 'idx_achievement_share_achievement',
      fields: ['achievement_id']
    },
    {
      name: 'idx_achievement_share_platform',
      fields: ['platform', 'created_at']
    }
  ]
});

AchievementShare.createShare = async function (playerId, achievementId, options = {}) {
  const {
    platform = 'internal',
    message,
    visibility = 'friends',
    expiresInDays
  } = options;

  const share = await AchievementShare.create({
    playerId,
    achievementId,
    platform,
    message,
    visibility,
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null
  });

  return share;
};

AchievementShare.getShareByToken = async function (token, viewerId = null) {
  const share = await AchievementShare.findOne({
    where: { shareToken: token },
    include: [
      { association: 'player', attributes: ['id', 'username', 'nickname', 'avatar', 'level'] },
      { association: 'achievement' }
    ]
  });

  if (!share) {
    throw new Error('SHARE_NOT_FOUND');
  }

  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new Error('SHARE_EXPIRED');
  }

  if (share.visibility === 'private' && share.playerId !== viewerId) {
    throw new Error('SHARE_NOT_AUTHORIZED');
  }

  if (share.visibility === 'friends' && share.playerId !== viewerId) {
    const { Friendship } = require('./index');
    const isFriend = await Friendship.findOne({
      where: {
        playerId: viewerId,
        friendId: share.playerId,
        status: 'accepted'
      }
    });
    if (!isFriend) {
      throw new Error('SHARE_NOT_AUTHORIZED');
    }
  }

  return share;
};

AchievementShare.incrementView = async function (token) {
  return AchievementShare.increment('viewCount', {
    where: { shareToken: token }
  });
};

AchievementShare.incrementLike = async function (token) {
  return AchievementShare.increment('likeCount', {
    where: { shareToken: token }
  });
};

AchievementShare.getPlayerShares = async function (playerId, options = {}) {
  const {
    visibility,
    platform,
    page = 1,
    limit = 20
  } = options;
  const offset = (page - 1) * limit;

  const where = {
    playerId,
    ...(visibility && { visibility }),
    ...(platform && { platform })
  };

  const { count, rows } = await AchievementShare.findAndCountAll({
    where,
    include: [{ association: 'achievement' }],
    limit,
    offset,
    order: [['created_at', 'DESC']]
  });

  return {
    shares: rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

module.exports = AchievementShare;
