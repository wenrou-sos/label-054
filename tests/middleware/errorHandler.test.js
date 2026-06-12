const { AppError, errorHandler, errorCodes } = require('../../src/middleware/errorHandler');

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create error with correct status code', () => {
      const error = new AppError('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.errorKey).toBe('NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });

    it('should use default error for unknown key', () => {
      const error = new AppError('UNKNOWN_KEY');
      expect(error.statusCode).toBe(500);
    });

    it('should include details when provided', () => {
      const details = { field: 'username', message: 'required' };
      const error = new AppError('VALIDATION_ERROR', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('errorCodes', () => {
    it('should define all required error codes', () => {
      expect(errorCodes.VALIDATION_ERROR).toBeDefined();
      expect(errorCodes.UNAUTHORIZED).toBeDefined();
      expect(errorCodes.FORBIDDEN).toBeDefined();
      expect(errorCodes.NOT_FOUND).toBeDefined();
      expect(errorCodes.INTERNAL_ERROR).toBeDefined();

      expect(errorCodes.PLAYER_NOT_FOUND).toBeDefined();
      expect(errorCodes.ALREADY_FRIENDS).toBeDefined();
      expect(errorCodes.CANNOT_ADD_SELF).toBeDefined();
      expect(errorCodes.FRIEND_NOT_FOUND).toBeDefined();
      expect(errorCodes.FRIEND_REQUEST_NOT_FOUND).toBeDefined();

      expect(errorCodes.ACHIEVEMENT_NOT_FOUND).toBeDefined();
      expect(errorCodes.ACHIEVEMENT_ALREADY_UNLOCKED).toBeDefined();
      expect(errorCodes.ACHIEVEMENT_CODE_EXISTS).toBeDefined();
    });
  });

  describe('errorHandler middleware', () => {
    const mockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    const mockReq = () => ({
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1'
    });

    it('should handle AppError correctly', () => {
      const err = new AppError('NOT_FOUND');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND'
          })
        })
      );
    });

    it('should handle validation errors from celebrate', () => {
      const err = {
        isCelebrateError: true,
        details: new Map([
          ['body', { details: [{ message: 'username is required' }] }]
        ])
      };
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle JWT errors', () => {
      const err = { name: 'JsonWebTokenError', message: 'invalid token' };
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle expired tokens', () => {
      const err = { name: 'TokenExpiredError', message: 'expired' };
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle Sequelize unique constraint errors', () => {
      const err = {
        name: 'SequelizeUniqueConstraintError',
        errors: [{ path: 'username', message: 'must be unique' }]
      };
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });
});
