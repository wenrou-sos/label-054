const { Player } = require('../src/models');

describe('Player Model', () => {
  describe('Player Creation', () => {
    it('should create a new player with valid data', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        nickname: '测试用户'
      });

      expect(player.id).toBeDefined();
      expect(player.username).toBe('testuser');
      expect(player.nickname).toBe('测试用户');
      expect(player.level).toBe(1);
      expect(player.status).toBe('offline');
      expect(player.isAdmin).toBe(false);
    });

    it('should not create player with duplicate username', async () => {
      await Player.create({
        username: 'testuser',
        email: 'test1@example.com',
        password: 'password123'
      });

      await expect(Player.create({
        username: 'testuser',
        email: 'test2@example.com',
        password: 'password123'
      })).rejects.toThrow();
    });

    it('should not create player with duplicate email', async () => {
      await Player.create({
        username: 'testuser1',
        email: 'test@example.com',
        password: 'password123'
      });

      await expect(Player.create({
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow();
    });

    it('should hash password before saving', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(player.password).not.toBe('password123');
      expect(player.password.length).toBeGreaterThan(10);
    });

    it('should set nickname to username if not provided', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(player.nickname).toBe('testuser');
    });
  });

  describe('Password Comparison', () => {
    it('should return true for correct password', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const isValid = await player.comparePassword('password123');
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const isValid = await player.comparePassword('wrongpassword');
      expect(isValid).toBe(false);
    });
  });

  describe('toJSON Method', () => {
    it('should exclude password and email from JSON output', async () => {
      const player = await Player.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const json = player.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.email).toBeUndefined();
      expect(json.username).toBe('testuser');
    });
  });

  describe('Player Search', () => {
    beforeEach(async () => {
      await Player.bulkCreate([
        { username: 'alice', email: 'alice@example.com', password: 'pass123', nickname: '爱丽丝', level: 10 },
        { username: 'bob', email: 'bob@example.com', password: 'pass123', nickname: '鲍勃', level: 5 },
        { username: 'charlie', email: 'charlie@example.com', password: 'pass123', nickname: '查理', level: 15 }
      ]);
    });

    it('should search players by username', async () => {
      const result = await Player.searchPlayers('ali');
      expect(result.players.length).toBeGreaterThan(0);
      expect(result.players.some(p => p.username === 'alice')).toBe(true);
    });

    it('should search players by nickname', async () => {
      const result = await Player.searchPlayers('鲍勃');
      expect(result.players.length).toBeGreaterThan(0);
      expect(result.players.some(p => p.nickname === '鲍勃')).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await Player.searchPlayers('', { page: 1, limit: 2 });
      expect(result.players.length).toBeLessThanOrEqual(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
    });

    it('should exclude specified player IDs', async () => {
      const players = await Player.findAll();
      const excludeId = players[0].id;
      const result = await Player.searchPlayers('', { excludeIds: [excludeId] });
      expect(result.players.some(p => p.id === excludeId)).toBe(false);
    });
  });
});
