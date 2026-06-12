const Player = require('./Player');
const Friendship = require('./Friendship');
const FriendRequest = require('./FriendRequest');
const Achievement = require('./Achievement');
const PlayerAchievement = require('./PlayerAchievement');
const AchievementShare = require('./AchievementShare');

Player.hasMany(Friendship, {
  foreignKey: 'playerId',
  as: 'friendships',
  onDelete: 'CASCADE'
});

Player.hasMany(Friendship, {
  foreignKey: 'friendId',
  as: 'reverseFriendships',
  onDelete: 'CASCADE'
});

Friendship.belongsTo(Player, {
  foreignKey: 'playerId',
  as: 'player'
});

Friendship.belongsTo(Player, {
  foreignKey: 'friendId',
  as: 'friend'
});

Player.hasMany(FriendRequest, {
  foreignKey: 'fromPlayerId',
  as: 'sentRequests',
  onDelete: 'CASCADE'
});

Player.hasMany(FriendRequest, {
  foreignKey: 'toPlayerId',
  as: 'receivedRequests',
  onDelete: 'CASCADE'
});

FriendRequest.belongsTo(Player, {
  foreignKey: 'fromPlayerId',
  as: 'fromPlayer'
});

FriendRequest.belongsTo(Player, {
  foreignKey: 'toPlayerId',
  as: 'toPlayer'
});

Achievement.hasMany(Achievement, {
  foreignKey: 'parentId',
  as: 'children'
});

Achievement.belongsTo(Achievement, {
  foreignKey: 'parentId',
  as: 'parent'
});

Achievement.hasMany(PlayerAchievement, {
  foreignKey: 'achievementId',
  as: 'playerAchievements',
  onDelete: 'CASCADE'
});

PlayerAchievement.belongsTo(Achievement, {
  foreignKey: 'achievementId',
  as: 'achievement'
});

Player.hasMany(PlayerAchievement, {
  foreignKey: 'playerId',
  as: 'achievements',
  onDelete: 'CASCADE'
});

PlayerAchievement.belongsTo(Player, {
  foreignKey: 'playerId',
  as: 'player'
});

Achievement.hasMany(AchievementShare, {
  foreignKey: 'achievementId',
  as: 'shares',
  onDelete: 'CASCADE'
});

AchievementShare.belongsTo(Achievement, {
  foreignKey: 'achievementId',
  as: 'achievement'
});

Player.hasMany(AchievementShare, {
  foreignKey: 'playerId',
  as: 'achievementShares',
  onDelete: 'CASCADE'
});

AchievementShare.belongsTo(Player, {
  foreignKey: 'playerId',
  as: 'player'
});

module.exports = {
  Player,
  Friendship,
  FriendRequest,
  Achievement,
  PlayerAchievement,
  AchievementShare
};
