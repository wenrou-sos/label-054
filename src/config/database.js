const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('./logger');

const sequelize = new Sequelize(
  config.database.name,
  config.database.user,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: 'postgres',
    pool: {
      min: config.database.pool.min,
      max: config.database.pool.max,
      acquire: config.database.pool.acquire,
      idle: config.database.pool.idle
    },
    logging: (msg) => logger.debug(msg),
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error('数据库连接失败:', error);
    throw error;
  }
};

const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info(`数据库同步完成${force ? '（强制）' : ''}`);
  } catch (error) {
    logger.error('数据库同步失败:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDatabase,
  syncDatabase
};
