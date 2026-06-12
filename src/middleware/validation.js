const { Joi, celebrate, Segments } = require('celebrate');

const idParamSchema = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().uuid()
    ).required()
  })
});

const paginationSchema = celebrate({
  [Segments.QUERY]: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }).unknown(true)
});

const authSchemas = {
  register: celebrate({
    [Segments.BODY]: Joi.object().keys({
      username: Joi.string().alphanum().min(3).max(50).required(),
      email: Joi.string().email().max(100).required(),
      password: Joi.string().min(6).max(50).required(),
      nickname: Joi.string().min(2).max(50).optional()
    })
  }),
  login: celebrate({
    [Segments.BODY]: Joi.object().keys({
      username: Joi.string().required(),
      password: Joi.string().required()
    })
  })
};

const playerSchemas = {
  update: celebrate({
    [Segments.BODY]: Joi.object().keys({
      nickname: Joi.string().min(2).max(50).optional(),
      avatar: Joi.string().uri().max(255).optional(),
      bio: Joi.string().max(500).optional().allow(''),
      location: Joi.string().max(100).optional().allow(''),
      birthday: Joi.date().optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'unknown').optional(),
      status: Joi.string().valid('online', 'offline', 'busy', 'away').optional(),
      preferences: Joi.object().keys({
        showOnlineStatus: Joi.boolean().optional(),
        allowFriendRequests: Joi.boolean().optional(),
        showAchievements: Joi.boolean().optional()
      }).optional()
    }).min(1)
  }),
  search: celebrate({
    [Segments.QUERY]: Joi.object().keys({
      q: Joi.string().min(1).max(100).required(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  })
};

const friendSchemas = {
  sendRequest: celebrate({
    [Segments.BODY]: Joi.object().keys({
      toPlayerId: Joi.number().integer().positive().required(),
      message: Joi.string().max(500).optional().allow('')
    })
  }),
  updateFriendship: celebrate({
    [Segments.BODY]: Joi.object().keys({
      remark: Joi.string().max(50).optional().allow(''),
      groupName: Joi.string().max(50).optional()
    }).min(1)
  }),
  getFriends: celebrate({
    [Segments.QUERY]: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      status: Joi.string().valid('accepted', 'pending', 'blocked').optional(),
      groupName: Joi.string().max(50).optional(),
      searchQuery: Joi.string().max(50).optional()
    })
  }),
  getRequests: celebrate({
    [Segments.QUERY]: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      type: Joi.string().valid('received', 'sent').default('received')
    })
  }),
  getRelation: celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      targetId: Joi.number().integer().positive().required()
    })
  })
};

const achievementSchemas = {
  create: celebrate({
    [Segments.BODY]: Joi.object().keys({
      code: Joi.string().max(100).required(),
      name: Joi.string().max(100).required(),
      description: Joi.string().required(),
      category: Joi.string().valid('combat', 'exploration', 'social', 'collection', 'progression', 'special').default('progression'),
      rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').default('common'),
      icon: Joi.string().uri().max(255).optional(),
      points: Joi.number().integer().min(0).default(10),
      conditionType: Joi.string().valid('counter', 'milestone', 'boolean', 'progressive').default('counter'),
      conditionConfig: Joi.object().default({}),
      rewards: Joi.object().default({
        experience: 0,
        items: [],
        currency: 0
      }),
      isActive: Joi.boolean().default(true),
      isHidden: Joi.boolean().default(false),
      order: Joi.number().integer().default(0),
      startsAt: Joi.date().optional(),
      expiresAt: Joi.date().optional()
    })
  }),
  update: celebrate({
    [Segments.BODY]: Joi.object().keys({
      name: Joi.string().max(100).optional(),
      description: Joi.string().optional(),
      category: Joi.string().valid('combat', 'exploration', 'social', 'collection', 'progression', 'special').optional(),
      rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
      icon: Joi.string().uri().max(255).optional(),
      points: Joi.number().integer().min(0).optional(),
      conditionConfig: Joi.object().optional(),
      rewards: Joi.object().optional(),
      isActive: Joi.boolean().optional(),
      isHidden: Joi.boolean().optional(),
      order: Joi.number().integer().optional(),
      startsAt: Joi.date().optional(),
      expiresAt: Joi.date().optional()
    }).min(1)
  }),
  list: celebrate({
    [Segments.QUERY]: Joi.object().keys({
      category: Joi.string().valid('combat', 'exploration', 'social', 'collection', 'progression', 'special').optional(),
      rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50)
    })
  }),
  trackEvent: celebrate({
    [Segments.BODY]: Joi.object().keys({
      event: Joi.string().max(100).required(),
      value: Joi.alternatives().try(
        Joi.number(),
        Joi.boolean()
      ).default(1),
      metadata: Joi.object().optional()
    })
  })
};

const shareSchemas = {
  create: celebrate({
    [Segments.BODY]: Joi.object().keys({
      achievementId: Joi.number().integer().positive().required(),
      platform: Joi.string().valid('internal', 'facebook', 'twitter', 'wechat', 'weibo', 'discord', 'other').default('internal'),
      message: Joi.string().max(500).optional().allow(''),
      visibility: Joi.string().valid('public', 'friends', 'private').default('friends'),
      expiresInDays: Joi.number().integer().min(1).max(365).optional()
    })
  }),
  list: celebrate({
    [Segments.QUERY]: Joi.object().keys({
      visibility: Joi.string().valid('public', 'friends', 'private').optional(),
      platform: Joi.string().valid('internal', 'facebook', 'twitter', 'wechat', 'weibo', 'discord', 'other').optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  })
};

module.exports = {
  idParamSchema,
  paginationSchema,
  authSchemas,
  playerSchemas,
  friendSchemas,
  achievementSchemas,
  shareSchemas
};
