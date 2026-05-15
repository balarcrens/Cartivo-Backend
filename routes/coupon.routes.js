const express = require('express');
const couponController = require('../controllers/coupon.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/active', couponController.getActiveCoupons);

router.use(authMiddleware.protect);

router.get('/check/:code', couponController.getCouponByCode);

router.route('/')
    .get(authMiddleware.restrictTo('admin'), couponController.getAllCoupons)
    .post(authMiddleware.restrictTo('admin'), couponController.createCoupon);

router.route('/:id')
    .patch(authMiddleware.restrictTo('admin'), couponController.updateCoupon)
    .delete(authMiddleware.restrictTo('admin'), couponController.deleteCoupon);

module.exports = router;
