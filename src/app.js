const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const logger = require('./config/logger');
const cacheManager = require('./config/redis');
const { connectDatabase, syncDatabase } = require('./config/database');
const { errorHandler, notFoundHandler, apiLimiter } = require('./middleware');
const routes = require('./routes');
const swaggerSpecs = require('./config/swagger');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: config.env === 'production' ? undefined : false
}));

app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('combined', {
  stream: logger.stream,
  skip: (req, res) => res.statusCode < 400 && config.env === 'production'
}));

app.use(config.api.prefix, apiLimiter);

app.use(`${config.api.prefix}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

app.get(`${config.api.prefix}/docs.json`, (req, res) => {
  res.json(swaggerSpecs);
});

app.use(config.api.prefix, routes);

app.use(notFoundHandler);
app.use(errorHandler);

const gracefulShutdown = async (signal) => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

  try {
    await cacheManager.disconnect();
    logger.info('Redis 连接已关闭');
  } catch (error) {
    logger.error('关闭 Redis 连接失败:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', { reason, promise });
  process.exit(1);
});

const startServer = async () => {
  try {
    await connectDatabase();
    await syncDatabase(config.env === 'development');
    await cacheManager.connect();

    const server = app.listen(config.port, () => {
      logger.info(`服务器启动成功`, {
        port: config.port,
        env: config.env,
        apiPrefix: config.api.prefix,
        docsUrl: `http://localhost:${config.port}${config.api.prefix}/docs`
      });
    });

    server.setTimeout(30000);

    return server;
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
