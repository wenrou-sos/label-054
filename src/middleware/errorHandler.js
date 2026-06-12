const { isCelebrateError } = require('celebrate');
const logger = require('../config/logger');

const errorCodes = {
  VALIDATION_ERROR: { code: 400, message: '请求参数验证失败' },
  UNAUTHORIZED: { code: 401, message: '未授权访问' },
  FORBIDDEN: { code: 403, message: '禁止访问' },
  NOT_FOUND: { code: 404, message: '资源不存在' },
  CONFLICT: { code: 409, message: '资源冲突' },
  RATE_LIMIT_EXCEEDED: { code: 429, message: '请求过于频繁，请稍后再试' },
  INTERNAL_ERROR: { code: 500, message: '服务器内部错误' },

  PLAYER_NOT_FOUND: { code: 404, message: '玩家不存在' },
  PLAYER_BANNED: { code: 403, message: '玩家已被封禁' },
  USERNAME_EXISTS: { code: 409, message: '用户名已存在' },
  EMAIL_EXISTS: { code: 409, message: '邮箱已存在' },
  INVALID_CREDENTIALS: { code: 401, message: '用户名或密码错误' },

  FRIEND_REQUEST_EXISTS: { code: 409, message: '好友请求已存在' },
  FRIEND_REQUEST_NOT_FOUND: { code: 404, message: '好友请求不存在' },
  FRIEND_REQUEST_EXPIRED: { code: 400, message: '好友请求已过期' },
  ALREADY_FRIENDS: { code: 409, message: '已经是好友了' },
  CANNOT_ADD_SELF: { code: 400, message: '不能添加自己为好友' },
  FRIEND_NOT_FOUND: { code: 404, message: '好友不存在' },

  ACHIEVEMENT_NOT_FOUND: { code: 404, message: '成就不存在' },
  ACHIEVEMENT_ALREADY_UNLOCKED: { code: 409, message: '成就已解锁' },
  ACHIEVEMENT_CODE_EXISTS: { code: 409, message: '成就代码已存在' },

  SHARE_NOT_FOUND: { code: 404, message: '分享不存在' },
  SHARE_EXPIRED: { code: 400, message: '分享已过期' },
  SHARE_NOT_AUTHORIZED: { code: 403, message: '无权限查看此分享' },

  ADMIN_REQUIRED: { code: 403, message: '需要管理员权限' },
  FRIEND_REQUESTS_DISABLED: { code: 403, message: '对方拒绝接收好友请求' }
};

class AppError extends Error {
  constructor(errorKey, details = null) {
    const errorInfo = errorCodes[errorKey] || errorCodes.INTERNAL_ERROR;
    super(errorInfo.message);
    this.name = 'AppError';
    this.errorKey = errorKey;
    this.statusCode = errorInfo.code;
    this.details = details;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let details = err.details;
  let errorKey = err.errorKey || 'INTERNAL_ERROR';

  if (isCelebrateError(err)) {
    statusCode = 400;
    message = '请求参数验证失败';
    errorKey = 'VALIDATION_ERROR';
    details = {};
    err.details.forEach((value, key) => {
      details[key] = value.details.map(d => d.message);
    });
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的访问令牌';
    errorKey = 'UNAUTHORIZED';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '访问令牌已过期';
    errorKey = 'UNAUTHORIZED';
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = '数据唯一性冲突';
    errorKey = 'CONFLICT';
    details = err.errors?.map(e => ({ field: e.path, message: e.message }));
  }

  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = '数据验证失败';
    errorKey = 'VALIDATION_ERROR';
    details = err.errors?.map(e => ({ field: e.path, message: e.message }));
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = '关联数据不存在';
    errorKey = 'VALIDATION_ERROR';
  }

  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = '服务暂时不可用';
    errorKey = 'INTERNAL_ERROR';
  }

  if (!err.isOperational && statusCode === 500) {
    logger.error('未处理的错误:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.warn('业务错误:', {
      errorKey,
      message,
      statusCode,
      path: req.path,
      method: req.method,
      details
    });
  }

  const response = {
    success: false,
    error: {
      code: errorKey,
      message,
      details
    }
  };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const notFoundHandler = (req, res, next) => {
  next(new AppError('NOT_FOUND'));
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  errorCodes
};
