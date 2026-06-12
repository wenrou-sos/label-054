const { sequelize, connectDatabase, syncDatabase } = require('../config/database');
const logger = require('../config/logger');
require('../models');

const initDatabase = async () => {
  try {
    logger.info('开始初始化数据库...');

    await connectDatabase();

    await sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS "pg_trgm";
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    logger.info('扩展创建完成');

    await syncDatabase(true);

    logger.info('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

initDatabase();
