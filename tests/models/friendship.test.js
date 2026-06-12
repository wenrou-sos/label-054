const { Friendship, Player } = require('../../src/models');

describe('Friendship Model', () => {
  let player1, player2, player3, player4;

  beforeEach(async () => {
    [player1, player2, player3, player4] = await Player.bulkCreate([
      { username: 'player1', email: 'p1@test.com', password: 'pass123' },
      { username: 'player2', email: 'p2@test.com', password: 'pass123' },
      { username: 'player3', email: 'p3@test.com', password: 'pass123' },
      { username: 'player4', email: 'p4@test.com', password: 'pass123' }
    ]);
  });

  describe('RELATION_LEVELS', () => {
    it('should define correct relation levels', () => {
      expect(Friendship.RELATION_LEVELS.DIRECT).toBe(0);
      expect(Friendship.RELATION_LEVELS.FRIEND_OF_FRIEND).toBe(1);
      expect(Friendship.RELATION_LEVELS.STRANGER).toBe(2);
    });
  });

  describe('createMutual', () => {
    it('should create bidirectional friendships', async () => {
      const { sequelize } = require('../../src/config/database');
      const transaction = await sequelize.transaction();

      try {
        const [f1, f2] = await Friendship.createMutual(player1.id, player2.id, transaction);
        await transaction.commit();

        expect(f1.playerId).toBe(player1.id);
        expect(f1.friendId).toBe(player2.id);
        expect(f1.status).toBe('accepted');
        expect(f1.relationLevel).toBe(0);

        expect(f2.playerId).toBe(player2.id);
        expect(f2.friendId).toBe(player1.id);
        expect(f2.status).toBe('accepted');
        expect(f2.relationLevel).toBe(0);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  });

  describe('removeMutual', () => {
    it('should remove both directions of friendship', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await t.commit();

      const t2 = await sequelize.transaction();
      const deleted = await Friendship.removeMutual(player1.id, player2.id, t2);
      await t2.commit();

      expect(deleted).toBe(2);

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
  });

  describe('getRelationLevel', () => {
    it('should return self for same player', async () => {
      const relation = await Friendship.getRelationLevel(player1.id, player1.id);
      expect(relation.level).toBe(-1);
      expect(relation.name).toBe('self');
    });

    it('should return direct for direct friends', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await t.commit();

      const relation = await Friendship.getRelationLevel(player1.id, player2.id);
      expect(relation.level).toBe(Friendship.RELATION_LEVELS.DIRECT);
      expect(relation.name).toBe('direct');
    });

    it('should return friend_of_friend for friend of friend', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await Friendship.createMutual(player2.id, player3.id, t);
      await t.commit();

      const relation = await Friendship.getRelationLevel(player1.id, player3.id);
      expect(relation.level).toBe(Friendship.RELATION_LEVELS.FRIEND_OF_FRIEND);
      expect(relation.name).toBe('friend_of_friend');
      expect(relation.mutualCount).toBeGreaterThan(0);
    });

    it('should return stranger for unknown players', async () => {
      const relation = await Friendship.getRelationLevel(player1.id, player4.id);
      expect(relation.level).toBe(Friendship.RELATION_LEVELS.STRANGER);
      expect(relation.name).toBe('stranger');
    });
  });

  describe('getFriends', () => {
    beforeEach(async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player1.id, player2.id, t);
      await Friendship.createMutual(player1.id, player3.id, t);
      await t.commit();
    });

    it('should return accepted friends list', async () => {
      const result = await Friendship.getFriends(player1.id);
      expect(result.friends.length).toBe(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should support search within friends', async () => {
      const result = await Friendship.getFriends(player1.id, { searchQuery: 'player2' });
      expect(result.friends.length).toBe(1);
      expect(result.friends[0].username).toBe('player2');
    });
  });
});
