const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: '游戏好友系统与成就服务 API',
      version: config.api.version,
      description: '基于 Node.js + Express + PostgreSQL 的游戏好友系统与成就服务 RESTful API 文档',
      contact: {
        name: 'API Support'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}${config.api.prefix}`,
        description: '开发环境'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        adminApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Admin-API-Key'
        }
      },
      schemas: {
        Player: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'player001' },
            nickname: { type: 'string', example: '玩家一号' },
            avatar: { type: 'string', example: 'https://example.com/avatar.png' },
            level: { type: 'integer', example: 10 },
            experience: { type: 'integer', example: 5000 },
            status: { type: 'string', enum: ['online', 'offline', 'busy', 'away'] },
            bio: { type: 'string', example: '这是我的简介' },
            location: { type: 'string', example: '北京' },
            birthday: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['male', 'female', 'other', 'unknown'] },
            stats: { type: 'object' },
            preferences: { type: 'object' },
            isAdmin: { type: 'boolean', example: false },
            lastActiveAt: { type: 'string', format: 'date-time' }
          }
        },
        Achievement: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            code: { type: 'string', example: 'FIRST_GAME_WON' },
            name: { type: 'string', example: '初出茅庐' },
            description: { type: 'string', example: '赢得第一场游戏' },
            category: {
              type: 'string',
              enum: ['combat', 'exploration', 'social', 'collection', 'progression', 'special']
            },
            rarity: {
              type: 'string',
              enum: ['common', 'uncommon', 'rare', 'epic', 'legendary']
            },
            icon: { type: 'string' },
            points: { type: 'integer', example: 10 },
            conditionType: {
              type: 'string',
              enum: ['counter', 'milestone', 'boolean', 'progressive']
            },
            conditionConfig: { type: 'object' },
            rewards: { type: 'object' },
            isActive: { type: 'boolean' },
            isHidden: { type: 'boolean' },
            unlockCount: { type: 'integer' }
          }
        },
        Friendship: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            playerId: { type: 'integer' },
            friendId: { type: 'integer' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'blocked'] },
            relationLevel: { type: 'integer', description: '0:直接好友, 1:好友的好友, 2:陌生人' },
            remark: { type: 'string' },
            groupName: { type: 'string' },
            mutualFriendsCount: { type: 'integer' },
            closeScore: { type: 'integer' },
            lastInteractedAt: { type: 'string', format: 'date-time' }
          }
        },
        FriendRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            fromPlayerId: { type: 'integer' },
            toPlayerId: { type: 'integer' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'cancelled'] },
            message: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            respondedAt: { type: 'string', format: 'date-time' }
          }
        },
        PlayerAchievement: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            playerId: { type: 'integer' },
            achievementId: { type: 'integer' },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            currentValue: { type: 'integer' },
            targetValue: { type: 'integer' },
            isUnlocked: { type: 'boolean' },
            unlockedAt: { type: 'string', format: 'date-time' },
            isSeen: { type: 'boolean' },
            seenAt: { type: 'string', format: 'date-time' }
          }
        },
        AchievementShare: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            shareToken: { type: 'string', format: 'uuid' },
            playerId: { type: 'integer' },
            achievementId: { type: 'integer' },
            platform: {
              type: 'string',
              enum: ['internal', 'facebook', 'twitter', 'wechat', 'weibo', 'discord', 'other']
            },
            message: { type: 'string' },
            visibility: { type: 'string', enum: ['public', 'friends', 'private'] },
            viewCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            expiresAt: { type: 'string', format: 'date-time' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 5 }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: '请求参数验证失败' },
                details: { type: 'object' }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            cached: { type: 'boolean' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
