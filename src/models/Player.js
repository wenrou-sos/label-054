const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const Player = sequelize.define('player', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  experience: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'busy', 'away'),
    defaultValue: 'offline'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  birthday: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other', 'unknown'),
    defaultValue: 'unknown'
  },
  stats: {
    type: DataTypes.JSONB,
    defaultValue: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalPlayTime: 0,
      friendsCount: 0,
      achievementsCount: 0
    }
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      showOnlineStatus: true,
      allowFriendRequests: true,
      showAchievements: true
    }
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastActiveAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  bannedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  banReason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  indexes: [
    {
      name: 'idx_player_username',
      fields: ['username'],
      unique: true
    },
    {
      name: 'idx_player_email',
      fields: ['email'],
      unique: true
    },
    {
      name: 'idx_player_status',
      fields: ['status']
    },
    {
      name: 'idx_player_level',
      fields: ['level']
    },
    {
      name: 'idx_player_username_search',
      fields: [sequelize.fn('lower', sequelize.col('username'))],
      using: 'gin',
      operator: 'gin_trgm_ops'
    },
    {
      name: 'idx_player_nickname_search',
      fields: [sequelize.fn('lower', sequelize.col('nickname'))],
      using: 'gin',
      operator: 'gin_trgm_ops'
    }
  ],
  hooks: {
    beforeCreate: async (player) => {
      if (player.password) {
        player.password = await bcrypt.hash(player.password, 12);
      }
      if (!player.nickname) {
        player.nickname = player.username;
      }
    },
    beforeUpdate: async (player) => {
      if (player.changed('password')) {
        player.password = await bcrypt.hash(player.password, 12);
      }
    }
  }
});

Player.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

Player.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.email;
  return values;
};

Player.prototype.toPublicJSON = function () {
  const values = this.toJSON();
  if (!this.preferences?.showOnlineStatus) {
    values.status = 'offline';
  }
  return values;
};

Player.searchPlayers = async function (query, options = {}) {
  const { page = 1, limit = 20, excludeIds = [] } = options;
  const offset = (page - 1) * limit;

  const searchQuery = `%${query.toLowerCase()}%`;

  const where = {
    [Op.and]: [
      {
        bannedAt: null
      },
      excludeIds.length > 0 ? { id: { [Op.notIn]: excludeIds } } : null,
      {
        [Op.or]: [
          sequelize.where(sequelize.fn('lower', sequelize.col('username')), 'LIKE', searchQuery),
          sequelize.where(sequelize.fn('lower', sequelize.col('nickname')), 'LIKE', searchQuery),
          sequelize.where(sequelize.cast(sequelize.col('id'), 'text'), 'LIKE', `%${query}%`)
        ]
      }
    ].filter(Boolean)
  };

  const { count, rows } = await Player.findAndCountAll({
    where,
    limit,
    offset,
    attributes: ['id', 'username', 'nickname', 'avatar', 'level', 'status', 'bio'],
    order: [
      ['level', 'DESC'],
      ['username', 'ASC']
    ]
  });

  return {
    players: rows.map(p => p.toPublicJSON()),
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

Player.getById = async function (id) {
  return Player.findByPk(id);
};

module.exports = Player;
