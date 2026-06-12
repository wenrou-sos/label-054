const express = require('express');
const { friendService } = require('../services');
const { friendSchemas, idParamSchema, paginationSchema } = require('../middleware/validation');
const { authenticate, friendRequestLimiter, cache, invalidateCache } = require('../middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', friendSchemas.getFriends, cache({
  keyGenerator: (req) => `friends:list:${req.player.id}:${JSON.stringify(req.query)}`,
  ttl: 60
}), async (req, res, next) => {
  try {
    const result = await friendService.getFriends(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests', friendRequestLimiter, friendSchemas.sendRequest, invalidateCache([
  (req) => `friends:requests:*:${req.player.id}`,
  (req) => `friends:requests:received:${req.body.toPlayerId}`
]), async (req, res, next) => {
  try {
    const { toPlayerId, message } = req.body;
    const request = await friendService.sendFriendRequest(
      req.player.id,
      toPlayerId,
      message
    );

    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', friendSchemas.getRequests, cache({
  keyGenerator: (req) => `friends:requests:${req.query.type || 'received'}:${req.player.id}`,
  ttl: 30
}), async (req, res, next) => {
  try {
    const result = await friendService.getFriendRequests(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/accept', idParamSchema, invalidateCache([
  (req) => `friends:list:${req.player.id}:*`,
  (req) => `friends:requests:*:${req.player.id}`
]), async (req, res, next) => {
  try {
    const result = await friendService.acceptFriendRequest(
      parseInt(req.params.id, 10),
      req.player.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/reject', idParamSchema, invalidateCache((req) => `friends:requests:*:${req.player.id}`), async (req, res, next) => {
  try {
    const result = await friendService.rejectFriendRequest(
      parseInt(req.params.id, 10),
      req.player.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:id/cancel', idParamSchema, invalidateCache((req) => `friends:requests:*:${req.player.id}`), async (req, res, next) => {
  try {
    const result = await friendService.cancelFriendRequest(
      parseInt(req.params.id, 10),
      req.player.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:friendId', idParamSchema, invalidateCache([
  (req) => `friends:list:${req.player.id}:*`,
  (req) => `friends:list:${req.params.friendId}:*`
]), async (req, res, next) => {
  try {
    const result = await friendService.removeFriend(
      req.player.id,
      parseInt(req.params.friendId, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:friendId', friendSchemas.updateFriendship, async (req, res, next) => {
  try {
    const friendship = await friendService.updateFriendship(
      req.player.id,
      parseInt(req.params.friendId, 10),
      req.body
    );

    res.json({
      success: true,
      data: friendship
    });
  } catch (error) {
    next(error);
  }
});

router.get('/relation/:targetId', friendSchemas.getRelation, async (req, res, next) => {
  try {
    const relation = await friendService.getRelationLevel(
      req.player.id,
      parseInt(req.params.targetId, 10)
    );

    res.json({
      success: true,
      data: relation
    });
  } catch (error) {
    next(error);
  }
});

router.get('/suggestions', paginationSchema, cache({
  keyGenerator: (req) => `friends:suggestions:${req.player.id}`,
  ttl: 300
}), async (req, res, next) => {
  try {
    const result = await friendService.getFriendOfFriends(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/mutual/:targetId', friendSchemas.getRelation, async (req, res, next) => {
  try {
    const mutual = await friendService.getMutualFriends(
      req.player.id,
      parseInt(req.params.targetId, 10)
    );

    res.json({
      success: true,
      data: mutual
    });
  } catch (error) {
    next(error);
  }
});

router.post('/block/:targetId', friendSchemas.getRelation, async (req, res, next) => {
  try {
    const result = await friendService.blockPlayer(
      req.player.id,
      parseInt(req.params.targetId, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unblock/:targetId', friendSchemas.getRelation, async (req, res, next) => {
  try {
    const result = await friendService.unblockPlayer(
      req.player.id,
      parseInt(req.params.targetId, 10)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/blocked', paginationSchema, async (req, res, next) => {
  try {
    const result = await friendService.getBlockedPlayers(req.player.id, req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
