const { Player, Achievement, PlayerAchievement, Friendship } = require('../../src/models');
const achievementService = require('../../src/services/achievementService');
const { AppError } = require('../../src/middleware/errorHandler');

describe('AchievementService', () => {
  let player;

  beforeEach(async () => {
    player = await Player.create({
      username: 'achplayer',
      email: 'ach@test.com',
      password: 'pass123'
    });
  });

  describe('Achievement CRUD', () => {
    it('should create achievement', async () => {
      const achievement = await achievementService.createAchievement({
        code: 'CRUD_TEST',
        name: 'CRUD测试成就',
        description: '测试创建',
        conditionConfig: { event: 'test' }
      });

      expect(achievement.code).toBe('CRUD_TEST');
    });

    it('should throw error for duplicate code', async () => {
      await achievementService.createAchievement({
        code: 'DUP_CODE',
        name: '成就1',
        description: 'd1',
        conditionConfig: { event: 'test' }
      });

      await expect(achievementService.createAchievement({
        code: 'DUP_CODE',
        name: '成就2',
        description: 'd2',
        conditionConfig: { event: 'test' }
      })).rejects.toThrow(AppError);
    });

    it('should update achievement', async () => {
      const achievement = await achievementService.createAchievement({
        code: 'UPDATE_TEST',
        name: '原名称',
        description: '原描述',
        conditionConfig: { event: 'test' }
      });

      const updated = await achievementService.updateAchievement(achievement.id, {
        name: '新名称',
        points: 100
      });

      expect(updated.name).toBe('新名称');
      expect(updated.points).toBe(100);
    });

    it('should delete achievement', async () => {
      const achievement = await achievementService.createAchievement({
        code: 'DELETE_TEST',
        name: '待删除',
        description: 'd',
        conditionConfig: { event: 'test' }
      });

      const result = await achievementService.deleteAchievement(achievement.id);
      expect(result.success).toBe(true);

      const found = await Achievement.findByPk(achievement.id);
      expect(found).toBeNull();
    });
  });

  describe('trackEvent and auto unlock', () => {
    beforeEach(async () => {
      await Achievement.bulkCreate([
        {
          code: 'PLAY_1',
          name: '玩一次',
          description: '玩一次游戏',
          conditionType: 'counter',
          conditionConfig: { event: 'game_played', target: 1 },
          points: 10
        },
        {
          code: 'PLAY_3',
          name: '玩三次',
          description: '玩三次游戏',
          conditionType: 'counter',
          conditionConfig: { event: 'game_played', target: 3 },
          points: 30
        },
        {
          code: 'WIN_STREAK_5',
          name: '五连胜',
          description: '连续赢五场',
          conditionType: 'milestone',
          conditionConfig: { event: 'win_streak', target: 5 },
          points: 50
        }
      ]);
    });

    it('should unlock achievement when event meets target', async () => {
      const result = await achievementService.trackEvent(player.id, 'game_played', 1);
      expect(result.unlocked.length).toBe(1);
      expect(result.unlocked[0].achievementCode).toBe('PLAY_1');
      expect(result.unlocked[0].isUnlocked).toBe(true);
    });

    it('should track progress without unlocking', async () => {
      const result = await achievementService.trackEvent(player.id, 'game_played', 2);
      const play3 = result.progress.find(p => p.achievementCode === 'PLAY_3');
      expect(play3.currentValue).toBe(2);
      expect(play3.progress).toBe(67);
      expect(play3.isUnlocked).toBe(false);
    });

    it('should handle milestone conditions', async () => {
      await achievementService.trackEvent(player.id, 'win_streak', 3);
      const result = await achievementService.trackEvent(player.id, 'win_streak', 5);

      const unlocked = result.unlocked.find(u => u.achievementCode === 'WIN_STREAK_5');
      expect(unlocked).toBeDefined();
      expect(unlocked.currentValue).toBe(5);
    });

    it('should not double unlock achievement', async () => {
      await achievementService.trackEvent(player.id, 'game_played', 1);
      const result = await achievementService.trackEvent(player.id, 'game_played', 1);
      const play1 = result.unlocked.find(u => u.achievementCode === 'PLAY_1');
      expect(play1).toBeUndefined();
    });
  });

  describe('compareWithFriend', () => {
    let friend;
    let achievement1, achievement2;

    beforeEach(async () => {
      [achievement1, achievement2] = await Achievement.bulkCreate([
        { code: 'CMP1', name: '成就1', description: 'd1', conditionConfig: { event: 'e1', target: 1 }, points: 10 },
        { code: 'CMP2', name: '成就2', description: 'd2', conditionConfig: { event: 'e2', target: 1 }, points: 20 }
      ]);

      friend = await Player.create({
        username: 'frienduser',
        email: 'friend@test.com',
        password: 'pass123'
      });

      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await Friendship.createMutual(player.id, friend.id, t);
      await t.commit();
    });

    it('should compare achievements with friend', async () => {
      await achievementService.trackEvent(player.id, 'e1', 1);
      await achievementService.trackEvent(friend.id, 'e1', 1);
      await achievementService.trackEvent(friend.id, 'e2', 1);

      const result = await achievementService.compareWithFriend(player.id, friend.id);

      expect(result.achievements.length).toBeGreaterThan(0);
      expect(result.stats.player.unlocked).toBe(1);
      expect(result.stats.friend.unlocked).toBe(2);
      expect(result.stats.comparison.bothUnlocked).toBe(1);
      expect(result.stats.comparison.friendOnly).toBe(1);
    });

    it('should throw error if not friends', async () => {
      const stranger = await Player.create({
        username: 'stranger',
        email: 'stranger@test.com',
        password: 'pass123'
      });

      await expect(achievementService.compareWithFriend(player.id, stranger.id)).rejects.toThrow(AppError);
    });
  });

  describe('getAchievementLeaderboard', () => {
    let achievement;
    let players;

    beforeEach(async () => {
      achievement = await Achievement.create({
        code: 'LEADERBOARD',
        name: '排行榜成就',
        description: 'd',
        conditionConfig: { event: 'test_leader', target: 1 },
        points: 100
      });

      players = await Player.bulkCreate([
        { username: 'lb1', email: 'lb1@test.com', password: 'pass', level: 10 },
        { username: 'lb2', email: 'lb2@test.com', password: 'pass', level: 20 },
        { username: 'lb3', email: 'lb3@test.com', password: 'pass', level: 30 }
      ]);

      await Promise.all(players.map(p =>
        achievementService.trackEvent(p.id, 'test_leader', 1)
      ));
    });

    it('should return achievement leaderboard', async () => {
      const result = await achievementService.getAchievementLeaderboard(achievement.id);
      expect(result.leaderboard.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });
  });
});
