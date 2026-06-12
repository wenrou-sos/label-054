const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const FriendRequest = sequelize.define('friend_request', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  fromPlayerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'player',
      key: 'id'
    }
  },
  toPlayerId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'player',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'cancelled'),
    defaultValue: 'pending'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  expiresAt: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  respondedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    {
      name: 'idx_friend_request_from_to',
      fields: ['from_player_id', 'to_player_id'],
      unique: true
    },
    {
      name: 'idx_friend_request_to',
      fields: ['to_player_id', 'status']
    },
    {
      name: 'idx_friend_request_from',
      fields: ['from_player_id', 'status']
    },
    {
      name: 'idx_friend_request_status',
      fields: ['status']
    },
    {
      name: 'idx_friend_request_expires',
      fields: ['expires_at']
    }
  ]
});

FriendRequest.createRequest = async function (fromPlayerId, toPlayerId, message) {
  const existingRequest = await FriendRequest.findOne({
    where: {
      [Op.or]: [
        { fromPlayerId, toPlayerId, status: 'pending' },
        { fromPlayerId: toPlayerId, toPlayerId: fromPlayerId, status: 'pending' }
      ]
    }
  });

  if (existingRequest) {
    throw new Error('FRIEND_REQUEST_EXISTS');
  }

  return FriendRequest.create({
    fromPlayerId,
    toPlayerId,
    message
  });
};

FriendRequest.acceptRequest = async function (requestId, playerId, transaction) {
  const request = await FriendRequest.findOne({
    where: {
      id: requestId,
      toPlayerId: playerId,
      status: 'pending'
    }
  });

  if (!request) {
    throw new Error('FRIEND_REQUEST_NOT_FOUND');
  }

  if (request.expiresAt < new Date()) {
    throw new Error('FRIEND_REQUEST_EXPIRED');
  }

  await request.update({
    status: 'accepted',
    respondedAt: new Date()
  }, { transaction });

  return request;
};

FriendRequest.rejectRequest = async function (requestId, playerId) {
  const request = await FriendRequest.findOne({
    where: {
      id: requestId,
      toPlayerId: playerId,
      status: 'pending'
    }
  });

  if (!request) {
    throw new Error('FRIEND_REQUEST_NOT_FOUND');
  }

  return request.update({
    status: 'rejected',
    respondedAt: new Date()
  });
};

FriendRequest.cancelRequest = async function (requestId, playerId) {
  const request = await FriendRequest.findOne({
    where: {
      id: requestId,
      fromPlayerId: playerId,
      status: 'pending'
    }
  });

  if (!request) {
    throw new Error('FRIEND_REQUEST_NOT_FOUND');
  }

  return request.update({
    status: 'cancelled',
    respondedAt: new Date()
  });
};

FriendRequest.getPendingRequests = async function (playerId, options = {}) {
  const { page = 1, limit = 20, type = 'received' } = options;
  const offset = (page - 1) * limit;

  const where = type === 'received'
    ? { toPlayerId: playerId, status: 'pending' }
    : { fromPlayerId: playerId, status: 'pending' };

  const include = type === 'received'
    ? [{ association: 'fromPlayer', attributes: ['id', 'username', 'nickname', 'avatar', 'level'] }]
    : [{ association: 'toPlayer', attributes: ['id', 'username', 'nickname', 'avatar', 'level'] }];

  const { count, rows } = await FriendRequest.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['created_at', 'DESC']]
  });

  return {
    requests: rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

FriendRequest.cleanupExpired = async function () {
  return FriendRequest.update(
    { status: 'rejected' },
    {
      where: {
        status: 'pending',
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    }
  );
};

module.exports = FriendRequest;
