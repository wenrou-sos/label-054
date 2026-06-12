const { sequelize } = require('../config/database');
const { Friendship, FriendRequest, Player } = require('../models');
const { AppError } = require('../middleware');
const logger = require('../config/logger');

class FriendService {
  async sendFriendRequest(fromPlayerId, toPlayerId, message = '') {
    if (fromPlayerId === toPlayerId) {
      throw new AppError('CANNOT_ADD_SELF');
    }

    const toPlayer = await Player.findByPk(toPlayerId);
    if (!toPlayer) {
      throw new AppError('PLAYER_NOT_FOUND');
    }

    if (toPlayer.bannedAt) {
      throw new AppError('PLAYER_BANNED');
    }

    if (!toPlayer.preferences?.allowFriendRequests) {
      throw new AppError('FRIEND_REQUESTS_DISABLED');
    }

    const existingFriendship = await Friendship.findOne({
      where: {
        playerId: fromPlayerId,
        friendId: toPlayerId,
        status: 'accepted'
      }
    });

    if (existingFriendship) {
      throw new AppError('ALREADY_FRIENDS');
    }

    const request = await FriendRequest.createRequest(fromPlayerId, toPlayerId, message);
    logger.info(`好友请求发送: ${fromPlayerId} -> ${toPlayerId}`);

    return request;
  }

  async acceptFriendRequest(requestId, playerId) {
    const transaction = await sequelize.transaction();

    try {
      const request = await FriendRequest.acceptRequest(requestId, playerId, transaction);

      await Friendship.createMutual(request.fromPlayerId, request.toPlayerId, transaction);

      await Player.update(
        {
          stats: sequelize.literal(`
            jsonb_set(
              stats,
              '{friendsCount}',
              to_jsonb(COALESCE((stats->>'friendsCount')::int, 0) + 1)
            )
          `)
        },
        {
          where: { id: [request.fromPlayerId, request.toPlayerId] },
          transaction
        }
      );

      await transaction.commit();
      logger.info(`好友请求接受: ${request.fromPlayerId} <-> ${request.toPlayerId}`);

      return {
        success: true,
        message: '好友添加成功',
        players: [request.fromPlayerId, request.toPlayerId]
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async rejectFriendRequest(requestId, playerId) {
    await FriendRequest.rejectRequest(requestId, playerId);
    logger.info(`好友请求拒绝: ${requestId}`);

    return { success: true, message: '已拒绝好友请求' };
  }

  async cancelFriendRequest(requestId, playerId) {
    await FriendRequest.cancelRequest(requestId, playerId);
    logger.info(`好友请求取消: ${requestId}`);

    return { success: true, message: '已取消好友请求' };
  }

  async getFriends(playerId, options = {}) {
    return Friendship.getFriends(playerId, options);
  }

  async getFriendRequests(playerId, options = {}) {
    return FriendRequest.getPendingRequests(playerId, options);
  }

  async removeFriend(playerId, friendId) {
    const transaction = await sequelize.transaction();

    try {
      const deleted = await Friendship.removeMutual(playerId, friendId, transaction);

      if (deleted === 0) {
        await transaction.rollback();
        throw new AppError('FRIEND_NOT_FOUND');
      }

      await Player.update(
        {
          stats: sequelize.literal(`
            jsonb_set(
              stats,
              '{friendsCount}',
              to_jsonb(GREATEST(COALESCE((stats->>'friendsCount')::int, 0) - 1, 0))
            )
          `)
        },
        {
          where: { id: [playerId, friendId] },
          transaction
        }
      );

      await transaction.commit();
      logger.info(`好友删除: ${playerId} - ${friendId}`);

      return { success: true, message: '已删除好友' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateFriendship(playerId, friendId, updateData) {
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

    await friendship.update(updateData);
    logger.info(`好友关系更新: ${playerId} -> ${friendId}`);

    return friendship;
  }

  async getRelationLevel(playerId, targetId) {
    return Friendship.getRelationLevel(playerId, targetId);
  }

  async getFriendOfFriends(playerId, options = {}) {
    return Friendship.getFriendOfFriends(playerId, options);
  }

  async getMutualFriends(playerId, targetId) {
    const query = `
      SELECT p.*
      FROM friendship f1
      INNER JOIN friendship f2 ON f1.friend_id = f2.friend_id
      INNER JOIN player p ON f1.friend_id = p.id
      WHERE f1.player_id = ?
        AND f2.player_id = ?
        AND f1.status = 'accepted'
        AND f2.status = 'accepted'
        AND p.banned_at IS NULL
      ORDER BY p.level DESC
    `;

    const [rows] = await sequelize.query(query, {
      replacements: [playerId, targetId],
      type: sequelize.QueryTypes.SELECT,
      model: Player,
      mapToModel: true
    });

    return rows.map(p => p.toPublicJSON());
  }

  async blockPlayer(playerId, targetId) {
    const existing = await Friendship.findOne({
      where: {
        playerId,
        friendId: targetId
      }
    });

    if (existing) {
      await existing.update({ status: 'blocked' });
    } else {
      await Friendship.create({
        playerId,
        friendId: targetId,
        status: 'blocked',
        relationLevel: Friendship.RELATION_LEVELS.STRANGER
      });
    }

    logger.info(`玩家被拉黑: ${playerId} -> ${targetId}`);

    return { success: true, message: '已拉黑该玩家' };
  }

  async unblockPlayer(playerId, targetId) {
    const friendship = await Friendship.findOne({
      where: {
        playerId,
        friendId: targetId,
        status: 'blocked'
      }
    });

    if (!friendship) {
      throw new AppError('FRIEND_NOT_FOUND');
    }

    await friendship.destroy();
    logger.info(`玩家被取消拉黑: ${playerId} -> ${targetId}`);

    return { success: true, message: '已取消拉黑' };
  }

  async getBlockedPlayers(playerId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await Friendship.findAndCountAll({
      where: {
        playerId,
        status: 'blocked'
      },
      include: [{
        association: 'friend',
        attributes: ['id', 'username', 'nickname', 'avatar', 'level']
      }],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    return {
      blocked: rows.map(f => f.friend.toPublicJSON()),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };
  }

  async cleanupExpiredRequests() {
    const result = await FriendRequest.cleanupExpired();
    if (result[0] > 0) {
      logger.info(`清理过期好友请求: ${result[0]} 条`);
    }
    return result[0];
  }
}

module.exports = new FriendService();
