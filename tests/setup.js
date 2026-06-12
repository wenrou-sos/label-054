process.env.NODE_ENV = 'test';

require('dotenv').config();

const { sequelize } = require('../src/config/database');
require('../src/models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.drop();
  await sequelize.close();
});

beforeEach(async () => {
  const { Player, Friendship, FriendRequest, Achievement, PlayerAchievement, AchievementShare } = require('../src/models');
  await AchievementShare.destroy({ where: {}, truncate: true, cascade: true });
  await PlayerAchievement.destroy({ where: {}, truncate: true, cascade: true });
  await Friendship.destroy({ where: {}, truncate: true, cascade: true });
  await FriendRequest.destroy({ where: {}, truncate: true, cascade: true });
  await Achievement.destroy({ where: {}, truncate: true, cascade: true });
  await Player.destroy({ where: {}, truncate: true, cascade: true });
});
