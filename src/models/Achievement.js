const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Achievement = sequelize.define('achievement', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('combat', 'exploration', 'social', 'collection', 'progression', 'special'),
    defaultValue: 'progression'
  },
  rarity: {
    type: DataTypes.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary'),
    defaultValue: 'common'
  },
  icon: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    validate: {
      min: 0
    }
  },
  conditionType: {
    type: DataTypes.ENUM('counter', 'milestone', 'boolean', 'progressive'),
    defaultValue: 'counter'
  },
  conditionConfig: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: '条件配置：{ target: 100, event: "game_won", interval: "lifetime" }'
  },
  rewards: {
    type: DataTypes.JSONB,
    defaultValue: {
      experience: 0,
      items: [],
      currency: 0
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isHidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  parentId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'achievement',
      key: 'id'
    }
  },
  startsAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  unlockCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  indexes: [
    {
      name: 'idx_achievement_code',
      fields: ['code'],
      unique: true
    },
    {
      name: 'idx_achievement_category',
      fields: ['category']
    },
    {
      name: 'idx_achievement_rarity',
      fields: ['rarity']
    },
    {
      name: 'idx_achievement_active',
      fields: ['is_active', 'is_hidden']
    },
    {
      name: 'idx_achievement_parent',
      fields: ['parent_id']
    },
    {
      name: 'idx_achievement_event',
      fields: [sequelize.json('condition_config', 'event')],
      using: 'gin'
    }
  ]
});

Achievement.findByCode = async function (code) {
  return Achievement.findOne({
    where: { code, isActive: true }
  });
};

Achievement.getActiveAchievements = async function (options = {}) {
  const { category, rarity, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const where = {
    isActive: true,
    isHidden: false,
    ...(category && { category }),
    ...(rarity && { rarity }),
    [Op.and]: [
      sequelize.literal(`(starts_at IS NULL OR starts_at <= NOW())`),
      sequelize.literal(`(expires_at IS NULL OR expires_at > NOW())`)
    ]
  };

  const { count, rows } = await Achievement.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['order', 'ASC'],
      ['points', 'DESC']
    ]
  });

  return {
    achievements: rows,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
};

Achievement.getByEvent = async function (eventName) {
  return Achievement.findAll({
    where: {
      isActive: true,
      [Op.and]: [
        sequelize.literal(`condition_config->>'event' = ?`, [eventName]),
        sequelize.literal(`(starts_at IS NULL OR starts_at <= NOW())`),
        sequelize.literal(`(expires_at IS NULL OR expires_at > NOW())`)
      ]
    }
  });
};

Achievement.prototype.checkCondition = function (currentValue) {
  const config = this.conditionConfig || {};
  const target = config.target || 1;

  switch (this.conditionType) {
    case 'boolean':
      return currentValue === true;
    case 'counter':
    case 'milestone':
    case 'progressive':
      return currentValue >= target;
    default:
      return false;
  }
};

Achievement.prototype.getProgress = function (currentValue) {
  const config = this.conditionConfig || {};
  const target = config.target || 1;

  if (this.conditionType === 'boolean') {
    return currentValue ? 100 : 0;
  }

  return Math.min(100, Math.round((currentValue / target) * 100));
};

module.exports = Achievement;
