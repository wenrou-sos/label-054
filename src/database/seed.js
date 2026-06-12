const { connectDatabase, syncDatabase } = require('../config/database');
const logger = require('../config/logger');
const { Player, Achievement } = require('../models');

const seedAchievements = [
  {
    code: 'first_game',
    name: '初出茅庐',
    description: '完成第一场游戏',
    category: 'progression',
    rarity: 'common',
    points: 10,
    conditionType: 'counter',
    conditionConfig: { event: 'game_played', target: 1 },
    order: 1
  },
  {
    code: 'games_10',
    name: '游戏爱好者',
    description: '累计完成10场游戏',
    category: 'progression',
    rarity: 'common',
    points: 20,
    conditionType: 'counter',
    conditionConfig: { event: 'game_played', target: 10 },
    order: 2
  },
  {
    code: 'games_100',
    name: '游戏达人',
    description: '累计完成100场游戏',
    category: 'progression',
    rarity: 'uncommon',
    points: 50,
    conditionType: 'counter',
    conditionConfig: { event: 'game_played', target: 100 },
    order: 3
  },
  {
    code: 'first_win',
    name: '首胜',
    description: '赢得第一场游戏',
    category: 'combat',
    rarity: 'common',
    points: 15,
    conditionType: 'counter',
    conditionConfig: { event: 'game_won', target: 1 },
    order: 4
  },
  {
    code: 'wins_10',
    name: '常胜将军',
    description: '累计赢得10场游戏',
    category: 'combat',
    rarity: 'uncommon',
    points: 30,
    conditionType: 'counter',
    conditionConfig: { event: 'game_won', target: 10 },
    order: 5
  },
  {
    code: 'wins_100',
    name: '百战百胜',
    description: '累计赢得100场游戏',
    category: 'combat',
    rarity: 'rare',
    points: 100,
    conditionType: 'counter',
    conditionConfig: { event: 'game_won', target: 100 },
    order: 6
  },
  {
    code: 'win_streak_5',
    name: '五连胜',
    description: '连续赢得5场游戏',
    category: 'combat',
    rarity: 'rare',
    points: 80,
    conditionType: 'milestone',
    conditionConfig: { event: 'win_streak', target: 5 },
    order: 7
  },
  {
    code: 'first_friend',
    name: '交友达人',
    description: '添加第一位好友',
    category: 'social',
    rarity: 'common',
    points: 15,
    conditionType: 'counter',
    conditionConfig: { event: 'friend_added', target: 1 },
    order: 8
  },
  {
    code: 'friends_10',
    name: '社交达人',
    description: '拥有10位好友',
    category: 'social',
    rarity: 'uncommon',
    points: 40,
    conditionType: 'counter',
    conditionConfig: { event: 'friend_added', target: 10 },
    order: 9
  },
  {
    code: 'friends_50',
    name: '社交明星',
    description: '拥有50位好友',
    category: 'social',
    rarity: 'rare',
    points: 100,
    conditionType: 'counter',
    conditionConfig: { event: 'friend_added', target: 50 },
    order: 10
  },
  {
    code: 'level_10',
    name: '小有成就',
    description: '等级达到10级',
    category: 'progression',
    rarity: 'uncommon',
    points: 50,
    conditionType: 'milestone',
    conditionConfig: { event: 'level_up', target: 10 },
    order: 11
  },
  {
    code: 'level_50',
    name: '游戏大师',
    description: '等级达到50级',
    category: 'progression',
    rarity: 'epic',
    points: 200,
    conditionType: 'milestone',
    conditionConfig: { event: 'level_up', target: 50 },
    order: 12
  },
  {
    code: 'first_achievement',
    name: '成就收集者',
    description: '解锁第一个成就',
    category: 'collection',
    rarity: 'common',
    points: 10,
    conditionType: 'counter',
    conditionConfig: { event: 'achievement_unlocked', target: 1 },
    order: 13
  },
  {
    code: 'achievements_10',
    name: '成就猎人',
    description: '解锁10个成就',
    category: 'collection',
    rarity: 'uncommon',
    points: 60,
    conditionType: 'counter',
    conditionConfig: { event: 'achievement_unlocked', target: 10 },
    order: 14
  },
  {
    code: 'all_achievements',
    name: '完美主义者',
    description: '解锁所有成就',
    category: 'collection',
    rarity: 'legendary',
    points: 500,
    conditionType: 'counter',
    conditionConfig: { event: 'achievement_unlocked', target: 15 },
    order: 15
  },
  {
    code: 'explore_all_maps',
    name: '探索者',
    description: '探索所有地图',
    category: 'exploration',
    rarity: 'epic',
    points: 150,
    conditionType: 'boolean',
    conditionConfig: { event: 'explore_maps', target: 1 },
    order: 16
  },
  {
    code: 'playtime_100h',
    name: '游戏狂热者',
    description: '累计游戏时长达到100小时',
    category: 'progression',
    rarity: 'rare',
    points: 120,
    conditionType: 'milestone',
    conditionConfig: { event: 'playtime', target: 360000 },
    order: 17
  }
];

const seedPlayers = [
  {
    username: 'admin',
    email: 'admin@game.com',
    password: 'admin123',
    nickname: '系统管理员',
    level: 99,
    isAdmin: true,
    bio: '游戏系统管理员'
  },
  {
    username: 'player1',
    email: 'player1@game.com',
    password: 'player123',
    nickname: '战神阿瑞斯',
    level: 25,
    bio: '热爱战斗的玩家',
    location: '北京'
  },
  {
    username: 'player2',
    email: 'player2@game.com',
    password: 'player123',
    nickname: '探索者艾琳',
    level: 18,
    bio: '喜欢探索未知区域',
    location: '上海'
  },
  {
    username: 'player3',
    email: 'player3@game.com',
    password: 'player123',
    nickname: '收藏家鲍勃',
    level: 32,
    bio: '收集各种稀有物品',
    location: '广州'
  },
  {
    username: 'player4',
    email: 'player4@game.com',
    password: 'player123',
    nickname: '社交达人',
    level: 15,
    bio: '认识很多朋友',
    location: '深圳'
  },
  {
    username: 'player5',
    email: 'player5@game.com',
    password: 'player123',
    nickname: '新人小白',
    level: 3,
    bio: '刚加入游戏的新人',
    location: '成都'
  }
];

const seedDatabase = async () => {
  try {
    logger.info('开始填充种子数据...');

    await connectDatabase();
    await syncDatabase(true);

    await Player.bulkCreate(seedPlayers);
    logger.info(`创建了 ${seedPlayers.length} 个玩家`);

    await Achievement.bulkCreate(seedAchievements);
    logger.info(`创建了 ${seedAchievements.length} 个成就`);

    logger.info('种子数据填充完成！');
    process.exit(0);
  } catch (error) {
    logger.error('种子数据填充失败:', error);
    process.exit(1);
  }
};

seedDatabase();
