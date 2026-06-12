const { Player } = require('../../src/models');
const playerService = require('../../src/services/playerService');
const { AppError } = require('../../src/middleware/errorHandler');

describe('PlayerService', () => {
  describe('register', () => {
    it('should register a new player successfully', async () => {
      const player = await playerService.register({
        username: 'newplayer',
        email: 'new@test.com',
        password: 'password123',
        nickname: '新玩家'
      });

      expect(player.id).toBeDefined();
      expect(player.username).toBe('newplayer');
      expect(player.nickname).toBe('新玩家');
    });

    it('should throw error for duplicate username', async () => {
      await Player.create({
        username: 'existing',
        email: 'existing1@test.com',
        password: 'pass123'
      });

      await expect(playerService.register({
        username: 'existing',
        email: 'existing2@test.com',
        password: 'pass123'
      })).rejects.toThrow(AppError);
    });

    it('should throw error for duplicate email', async () => {
      await Player.create({
        username: 'user1',
        email: 'same@test.com',
        password: 'pass123'
      });

      await expect(playerService.register({
        username: 'user2',
        email: 'same@test.com',
        password: 'pass123'
      })).rejects.toThrow(AppError);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await Player.create({
        username: 'loginuser',
        email: 'login@test.com',
        password: 'mypassword',
        nickname: '登录用户'
      });
    });

    it('should login with correct username and password', async () => {
      const player = await playerService.login('loginuser', 'mypassword');
      expect(player.username).toBe('loginuser');
    });

    it('should login with correct email and password', async () => {
      const player = await playerService.login('login@test.com', 'mypassword');
      expect(player.email).toBe('login@test.com');
    });

    it('should throw error for wrong password', async () => {
      await expect(playerService.login('loginuser', 'wrongpass')).rejects.toThrow(AppError);
    });

    it('should throw error for non-existent user', async () => {
      await expect(playerService.login('nonexistent', 'pass')).rejects.toThrow(AppError);
    });

    it('should throw error for banned player', async () => {
      await Player.create({
        username: 'banneduser',
        email: 'banned@test.com',
        password: 'pass123',
        bannedAt: new Date()
      });

      await expect(playerService.login('banneduser', 'pass123')).rejects.toThrow(AppError);
    });
  });

  describe('getProfile', () => {
    let player1, player2;

    beforeEach(async () => {
      [player1, player2] = await Player.bulkCreate([
        {
          username: 'profile1',
          email: 'p1@test.com',
          password: 'pass123',
          preferences: { showOnlineStatus: true, showAchievements: true }
        },
        {
          username: 'profile2',
          email: 'p2@test.com',
          password: 'pass123',
          preferences: { showOnlineStatus: false, showAchievements: false }
        }
      ]);
    });

    it('should return own profile with full info', async () => {
      const profile = await playerService.getProfile(player1.id, player1.id);
      expect(profile.id).toBe(player1.id);
      expect(profile.stats).toBeDefined();
    });

    it('should respect other player privacy settings', async () => {
      const profile = await playerService.getProfile(player2.id, player1.id);
      expect(profile.status).toBe('offline');
      expect(profile.stats).toBeUndefined();
    });
  });

  describe('searchPlayers', () => {
    beforeEach(async () => {
      await Player.bulkCreate([
        { username: 'searcher1', email: 's1@test.com', password: 'pass', nickname: '搜索者一号' },
        { username: 'searcher2', email: 's2@test.com', password: 'pass', nickname: '搜索者二号' },
        { username: 'other', email: 'o@test.com', password: 'pass', nickname: '其他用户' }
      ]);
    });

    it('should search by username', async () => {
      const result = await playerService.searchPlayers('searcher');
      expect(result.players.length).toBe(2);
    });

    it('should return empty for empty query', async () => {
      const result = await playerService.searchPlayers('');
      expect(result.players.length).toBe(0);
    });
  });

  describe('updateProfile', () => {
    it('should update player profile', async () => {
      const player = await Player.create({
        username: 'updateuser',
        email: 'update@test.com',
        password: 'pass123'
      });

      const updated = await playerService.updateProfile(player.id, {
        nickname: '更新后昵称',
        bio: '这是简介'
      });

      expect(updated.nickname).toBe('更新后昵称');
      expect(updated.bio).toBe('这是简介');
    });

    it('should merge preferences instead of replacing', async () => {
      const player = await Player.create({
        username: 'prefuser',
        email: 'pref@test.com',
        password: 'pass123',
        preferences: { showOnlineStatus: true, allowFriendRequests: true, showAchievements: true }
      });

      await playerService.updateProfile(player.id, {
        preferences: { showOnlineStatus: false }
      });

      const refreshed = await Player.findByPk(player.id);
      expect(refreshed.preferences.showOnlineStatus).toBe(false);
      expect(refreshed.preferences.allowFriendRequests).toBe(true);
    });
  });
});
