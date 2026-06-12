const { DataTypes, Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');

const Friendship = sequelize.define('friendship', {
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
  friendId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'player',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
    defaultValue: 'pending'
  },
  relationLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '0: 直接好友, 1: 好友的好友, 2: 陌生人'
  },
  remark: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  groupName: {
    type: DataTypes.STRING(50),
    defaultValue: '默认分组'
  },
  mutualFriendsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  closeScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  lastInteractedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    {
      name: 'idx_friendship_player_friend',
      fields: ['player_id', 'friend_id'],
      unique: true
    },
    {
      name: 'idx_friendship_friend_player',
      fields: ['friend_id', 'player_id']
    },
    {
      name: 'idx_friendship_status',
      fields: ['status']
    },
    {
      name: 'idx_friendship_relation_level',
      fields: ['relation_level']
    },
    {
      name: 'idx_friendship_close_score',
      fields: ['close_score']
    },
    {
      name: 'idx_friendship_group',
      fields: ['player_id', 'group_name']
    }
  ]
});

Friendship.RELATION_LEVELS = {
  DIRECT: 0,
  FRIEND_OF_FRIEND: 1,
  STRANGER: 2
};

Friendship.getFriends = async function (playerId, options = {}) {
  const {
    status = 'accepted',
    page = 1,
    limit = 50,
    groupName,
    searchQuery
  } = options;
  const offset = (page - 1) * limit;

  const where = {
    playerId,
    status,
    ...(groupName && { groupName })
  };

  if (searchQuery) {
    const searchPattern = `%${searchQuery.toLowerCase()}%`;
    where[Op.and] = [
      literal(`EXISTS (
        SELECT 1 FROM player p 
        WHERE p.id = friendship.friend_id 
        AND (LOWER(p.username) LIKE ? OR LOWER(p.nickname) LIKE ?)
      )`, [searchPattern, searchPattern])
    ];
  }

  const { count, rows } = await Friendship.findAndCountAll({
    where,
    limit,
    offset,
    include: [{
      association: 'friend',
      attributes: ['id', 'username', 'nickname', 'avatar', 'level', 'status', 'bio']
    }],
    order: [
      ['close_score', 'DESC'],
      ['last_interacted_at', 'DESC']
    ]
  });

  return {
    friends: rows.map(f => ({
      ...f.friend.toPublicJSON(),
      remark: f.remark,
      groupName: f.groupName,
      closeScore: f.closeScore,
      mutualFriendsCount: f.mutualFriendsCount,
      relationLevel: f.relationLevel
    })),
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

Friendship.getRelationLevel = async function (playerId, targetId) {
  if (playerId === targetId) return { level: -1, name: 'self' };

  const directFriend = await Friendship.findOne({
    where: {
      playerId,
      friendId: targetId,
      status: 'accepted'
    }
  });

  if (directFriend) {
    return {
      level: Friendship.RELATION_LEVELS.DIRECT,
      name: 'direct',
      friendship: directFriend
    };
  }

  const mutualFriends = await Friendship.count({
    where: {
      playerId,
      status: 'accepted',
      friendId: {
        [Op.in]: literal(`(
          SELECT friend_id FROM friendship 
          WHERE player_id = ? AND status = 'accepted'
        )`, [targetId])
      }
    }
  });

  if (mutualFriends > 0) {
    return {
      level: Friendship.RELATION_LEVELS.FRIEND_OF_FRIEND,
      name: 'friend_of_friend',
      mutualCount: mutualFriends
    };
  }

  return {
    level: Friendship.RELATION_LEVELS.STRANGER,
    name: 'stranger'
  };
};

Friendship.getFriendOfFriends = async function (playerId, options = {}) {
  const { page = 1, limit = 50, excludeIds = [] } = options;
  const offset = (page - 1) * limit;

  const excludeAll = [...excludeIds, playerId];

  const query = `
    SELECT 
      fof.id,
      fof.username,
      fof.nickname,
      fof.avatar,
      fof.level,
      fof.status,
      fof.bio,
      COUNT(DISTINCT mf.friend_id) as mutual_friends_count
    FROM friendship f1
    INNER JOIN friendship f2 ON f1.friend_id = f2.player_id
    INNER JOIN player fof ON f2.friend_id = fof.id
    LEFT JOIN friendship mf ON mf.player_id = ? AND mf.friend_id = fof.id AND mf.status = 'accepted'
    WHERE f1.player_id = ? 
      AND f1.status = 'accepted'
      AND f2.status = 'accepted'
      AND fof.id NOT IN (?)
      AND fof.banned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM friendship existing
        WHERE existing.player_id = ? 
          AND existing.friend_id = fof.id 
          AND existing.status IN ('accepted', 'blocked')
      )
    GROUP BY fof.id, fof.username, fof.nickname, fof.avatar, fof.level, fof.status, fof.bio
    ORDER BY mutual_friends_count DESC, fof.level DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT f2.friend_id) as total
    FROM friendship f1
    INNER JOIN friendship f2 ON f1.friend_id = f2.player_id
    INNER JOIN player fof ON f2.friend_id = fof.id
    WHERE f1.player_id = ? 
      AND f1.status = 'accepted'
      AND f2.status = 'accepted'
      AND fof.id NOT IN (?)
      AND fof.banned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM friendship existing
        WHERE existing.player_id = ? 
          AND existing.friend_id = fof.id 
          AND existing.status IN ('accepted', 'blocked')
      )
  `;

  const [countResult] = await sequelize.query(countQuery, {
    replacements: [playerId, excludeAll, playerId],
    type: sequelize.QueryTypes.SELECT
  });

  const [rows] = await sequelize.query(query, {
    replacements: [playerId, playerId, excludeAll, playerId, limit, offset],
    type: sequelize.QueryTypes.SELECT
  });

  return {
    friends: rows.map(f => ({
      id: f.id,
      username: f.username,
      nickname: f.nickname,
      avatar: f.avatar,
      level: f.level,
      status: f.status,
      bio: f.bio,
      mutualFriendsCount: parseInt(f.mutual_friends_count, 10)
    })),
    pagination: {
      page,
      limit,
      total: parseInt(countResult.total, 10),
      pages: Math.ceil(parseInt(countResult.total, 10) / limit)
    }
  };
};

Friendship.createMutual = async function (playerId, friendId, transaction) {
  const [friendship1, friendship2] = await Promise.all([
    Friendship.create({
      playerId,
      friendId,
      status: 'accepted',
      relationLevel: Friendship.RELATION_LEVELS.DIRECT
    }, { transaction }),
    Friendship.create({
      playerId: friendId,
      friendId: playerId,
      status: 'accepted',
      relationLevel: Friendship.RELATION_LEVELS.DIRECT
    }, { transaction })
  ]);

  return [friendship1, friendship2];
};

Friendship.removeMutual = async function (playerId, friendId, transaction) {
  return Friendship.destroy({
    where: {
      [Op.or]: [
        { playerId, friendId },
        { playerId: friendId, friendId: playerId }
      ]
    },
    transaction
  });
};

module.exports = Friendship;
