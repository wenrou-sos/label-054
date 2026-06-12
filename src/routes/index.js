const express = require('express');
const authRoutes = require('./auth');
const playerRoutes = require('./player');
const friendRoutes = require('./friend');
const achievementRoutes = require('./achievement');
const shareRoutes = require('./share');
const adminRoutes = require('./admin');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/players', playerRoutes);
router.use('/friends', friendRoutes);
router.use('/achievements', achievementRoutes);
router.use('/shares', shareRoutes);
router.use('/admin', adminRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

module.exports = router;
