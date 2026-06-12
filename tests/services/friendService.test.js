const { Player, Friendship } = require('../../src/models');
const friendService = require('../../src/services/friendService');
const { AppError } = require('../../src/middleware/errorHandler');

describe('FriendService', () => {
  let player1, player2, player3;

  beforeEach(async () => {
    [player1, player2, player3] = await Player.bulkCreate([
      { username: 'fuser1', email: 'f1@test.com', password: 'pass123' },
      { username: 'fuser2', email: 'f2@test.com', password: 'pass123' },
      { username: 'fuser3', email: 'f3@test.com', password: 'pass123' }
    ]);
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      const request = await friendService.sendFriendRequest(player1.id, player2.id, '你好！');
      expect(request.fromPlayerId).toBe(player1.id);
      expect(request.toPlayerId).toBe(player2.id);
      expect(request.status).toBe('pending');
    });

    it('should throw error when adding self', async () => {
      await expect(friendService.sendFriendRequest(player1.id, player1.id)).rejects.toThrow(AppError);
    });

    it('should throw error when player not found', async () => {
      await expect(friendService.sendFriendRequest(player1.id, 99999)).rejects.toThrow(AppError);
    });

    it('should throw error when already friends', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await t.commit();

      await expect(friendService.sendFriendRequest(player1.id, player2.id)).rejects.toThrow(AppError);
    });

    it('should throw error when friend requests disabled', async () => {
      await player2.update({ preferences: { allowFriendRequests: false } });

      await expect(friendService.sendFriendRequest(player1.id, player2.id)).rejects.toThrow(AppError);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept request and create mutual friendship', async () => {
      const request = await friendService.sendFriendRequest(player1.id, player2.id);
      const result = await friendService.acceptFriendRequest(request.id, player2.id);

      expect(result.success).toBe(true);

      const friendship1 = await Friendship.findOne({
        where: { playerId: player1.id, friendId: player2.id, status: 'accepted' }
      });
      const friendship2 = await Friendship.findOne({
        where: { playerId: player2.id, friendId: player1.id, status: 'accepted' }
      });

      expect(friendship1).not.toBeNull();
      expect(friendship2).not.toBeNull();
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject friend request', async () => {
      const request = await friendService.sendFriendRequest(player1.id, player2.id);
      const result = await friendService.rejectFriendRequest(request.id, player2.id);

      expect(result.success).toBe(true);
    });
  });

  describe('removeFriend', () => {
    beforeEach(async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await t.commit();
    });

    it('should remove friendship bidirectionally', async () => {
      const result = await friendService.removeFriend(player1.id, player2.id);
      expect(result.success).toBe(true);

      const remaining = await Friendship.count({
        where: {
          [require('sequelize').Op.or]: [
            { playerId: player1.id, friendId: player2.id },
            { playerId: player2.id, friendId: player1.id }
          ]
        }
      });
      expect(remaining).toBe(0);
    });

    it('should throw error if not friends', async () => {
      await expect(friendService.removeFriend(player1.id, player3.id)).rejects.toThrow(AppError);
    });
  });

  describe('getRelationLevel', () => {
    it('should identify direct friends', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await t.commit();

      const relation = await friendService.getRelationLevel(player1.id, player2.id);
      expect(relation.level).toBe(0);
      expect(relation.name).toBe('direct');
    });

    it('should identify friends of friends', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await Friendship.createMutual(player2.id, player3.id, t);
      await t.commit();

      const relation = await friendService.getRelationLevel(player1.id, player3.id);
      expect(relation.level).toBe(1);
      expect(relation.name).toBe('friend_of_friend');
    });
  });

  describe('block/unblock player', () => {
    it('should block a player', async () => {
      const result = await friendService.blockPlayer(player1.id, player2.id);
      expect(result.success).toBe(true);

      const blocked = await Friendship.findOne({
        where: { playerId: player1.id, friendId: player2.id, status: 'blocked' }
      });
      expect(blocked).not.toBeNull();
    });

    it('should unblock a player', async () => {
      await friendService.blockPlayer(player1.id, player2.id);
      const result = await friendService.unblockPlayer(player1.id, player2.id);
      expect(result.success).toBe(true);
    });
  });
});
