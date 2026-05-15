const express = require('express');
const orderController = require('../controllers/order.controller');
const returnController = require('../controllers/return.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
    .get(orderController.getMyOrders)
    .post(orderController.createOrder);

router.get('/all', authMiddleware.restrictTo('admin'), orderController.getAllOrders);
router.post('/verify-payment', orderController.verifyPayment);

router.post('/request-return', returnController.requestReturn);
router.get('/:orderId/return-status', returnController.getOrderReturnStatus);

router.get('/returns/all', authMiddleware.restrictTo('admin'), returnController.getAllReturns);
router.patch('/returns/:id', authMiddleware.restrictTo('admin'), returnController.updateReturnStatus);

router.route('/:id')
    .get(orderController.getOrder)
    .patch(authMiddleware.restrictTo('admin', 'vendor'), orderController.updateStatus);

module.exports = router;
