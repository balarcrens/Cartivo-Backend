const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../middlewares/auth');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', adminController.getDashboardStats);
router.get('/recent-orders', adminController.getRecentOrders);

module.exports = router;
