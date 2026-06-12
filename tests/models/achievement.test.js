const { Achievement, Player, PlayerAchievement } = require('../../src/models');

describe('Achievement Model', () => {
  describe('Achievement Creation', () => {
    it('should create an achievement with valid data', async () => {
      const achievement = await Achievement.create({
        code: 'TEST_ACHIEVEMENT',
        name: '测试成就',
        description: '这是一个测试成就',
        category: 'progression',
        rarity: 'common',
        points: 10,
        conditionType: 'counter',
        conditionConfig: { event: 'test_event', target: 1 }
      });

      expect(achievement.id).toBeDefined();
      expect(achievement.code).toBe('TEST_ACHIEVEMENT');
      expect(achievement.isActive).toBe(true);
      expect(achievement.isHidden).toBe(false);
      expect(achievement.unlockCount).toBe(0);
    });

    it('should not create achievement with duplicate code', async () => {
      await Achievement.create({
        code: 'TEST_ACHIEVEMENT',
        name: '测试成就1',
        description: '描述1',
        conditionConfig: { event: 'test' }
      });

      await expect(Achievement.create({
        code: 'TEST_ACHIEVEMENT',
        name: '测试成就2',
        description: '描述2',
        conditionConfig: { event: 'test' }
      })).rejects.toThrow();
    });
  });

  describe('findByCode', () => {
    it('should find active achievement by code', async () => {
      await Achievement.create({
        code: 'ACTIVE_ACH',
        name: '活跃成就',
        description: '描述',
        isActive: true,
        conditionConfig: { event: 'test' }
      });

      const achievement = await Achievement.findByCode('ACTIVE_ACH');
      expect(achievement).not.toBeNull();
      expect(achievement.code).toBe('ACTIVE_ACH');
    });

    it('should not find inactive achievement', async () => {
      await Achievement.create({
        code: 'INACTIVE_ACH',
        name: '不活跃成就',
        description: '描述',
        isActive: false,
        conditionConfig: { event: 'test' }
      });

      const achievement = await Achievement.findByCode('INACTIVE_ACH');
      expect(achievement).toBeNull();
    });
  });

  describe('getActiveAchievements', () => {
    beforeEach(async () => {
      await Achievement.bulkCreate([
        { code: 'A1', name: '战斗成就', description: 'd1', category: 'combat', rarity: 'rare', conditionConfig: { event: 'test' } },
        { code: 'A2', name: '探索成就', description: 'd2', category: 'exploration', rarity: 'common', conditionConfig: { event: 'test' } },
        { code: 'A3', name: '社交成就', description: 'd3', category: 'social', rarity: 'epic', conditionConfig: { event: 'test' } },
        { code: 'HIDDEN', name: '隐藏成就', description: 'd4', category: 'special', isHidden: true, conditionConfig: { event: 'test' } },
        { code: 'INACTIVE', name: '不活跃', description: 'd5', category: 'special', isActive: false, conditionConfig: { event: 'test' } }
      ]);
    });

    it('should return only active and visible achievements', async () => {
      const result = await Achievement.getActiveAchievements();
      expect(result.achievements.length).toBe(3);
      expect(result.achievements.some(a => a.code === 'HIDDEN')).toBe(false);
      expect(result.achievements.some(a => a.code === 'INACTIVE')).toBe(false);
    });

    it('should filter by category', async () => {
      const result = await Achievement.getActiveAchievements({ category: 'combat' });
      expect(result.achievements.length).toBe(1);
      expect(result.achievements[0].category).toBe('combat');
    });

    it('should filter by rarity', async () => {
      const result = await Achievement.getActiveAchievements({ rarity: 'common' });
      expect(result.achievements.length).toBe(1);
      expect(result.achievements[0].rarity).toBe('common');
    });
  });

  describe('checkCondition', () => {
    it('should check boolean condition correctly', () => {
      const achievement = Achievement.build({ conditionType: 'boolean' });
      expect(achievement.checkCondition(true)).toBe(true);
      expect(achievement.checkCondition(false)).toBe(false);
    });

    it('should check counter condition correctly', () => {
      const achievement = Achievement.build({
        conditionType: 'counter',
        conditionConfig: { target: 10 }
      });
      expect(achievement.checkCondition(9)).toBe(false);
      expect(achievement.checkCondition(10)).toBe(true);
      expect(achievement.checkCondition(15)).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('should calculate progress correctly', () => {
      const achievement = Achievement.build({
        conditionType: 'counter',
        conditionConfig: { target: 100 }
      });
      expect(achievement.getProgress(0)).toBe(0);
      expect(achievement.getProgress(50)).toBe(50);
      expect(achievement.getProgress(100)).toBe(100);
      expect(achievement.getProgress(150)).toBe(100);
    });

    it('should handle boolean progress', () => {
      const achievement = Achievement.build({ conditionType: 'boolean' });
      expect(achievement.getProgress(false)).toBe(0);
      expect(achievement.getProgress(true)).toBe(100);
    });
  });
});

describe('PlayerAchievement Model', () => {
  let player, achievement;

  beforeEach(async () => {
    player = await Player.create({
      username: 'testach',
      email: 'testach@test.com',
      password: 'pass123'
    });

    achievement = await Achievement.create({
      code: 'PROGRESS_TEST',
      name: '进度测试',
      description: '测试进度',
      conditionType: 'counter',
      conditionConfig: { event: 'test_progress', target: 10 },
      points: 20
    });
  });

  describe('updateProgress', () => {
    it('should create player achievement record if not exists', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();

      try {
        const pa = await PlayerAchievement.updateProgress(player.id, achievement, 3, t);
        await t.commit();

        expect(pa.currentValue).toBe(3);
        expect(pa.progress).toBe(30);
        expect(pa.isUnlocked).toBe(false);
      } catch (error) {
        await t.rollback();
        throw error;
      }
    });

    it('should unlock achievement when target reached', async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();

      try {
        const pa = await PlayerAchievement.updateProgress(player.id, achievement, 10, t);
        await t.commit();

        expect(pa.currentValue).toBe(10);
        expect(pa.progress).toBe(100);
        expect(pa.isUnlocked).toBe(true);
        expect(pa.unlockedAt).toBeDefined();
      } catch (error) {
        await t.rollback();
        throw error;
      }
    });

    it('should not change if already unlocked', async () => {
      const { sequelize } = require('../../src/config/database');
      const t1 = await sequelize.transaction();
      await PlayerAchievement.updateProgress(player.id, achievement, 10, t1);
      await t1.commit();

      const t2 = await sequelize.transaction();
      const pa = await PlayerAchievement.updateProgress(player.id, achievement, 5, t2);
      await t2.commit();

      expect(pa.currentValue).toBe(10);
      expect(pa.isUnlocked).toBe(true);
    });
  });

  describe('getPlayerAchievements', () => {
    beforeEach(async () => {
      const { sequelize } = require('../../src/config/database');
      const t = await sequelize.transaction();
      await PlayerAchievement.updateProgress(player.id, achievement, 10, t);
      await t.commit();
    });

    it('should return player achievements', async () => {
      const result = await PlayerAchievement.getPlayerAchievements(player.id);
      expect(result.achievements.length).toBe(1);
      expect(result.achievements[0].isUnlocked).toBe(true);
    });
  });
});
