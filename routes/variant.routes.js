const express = require('express');
const variantController = require('../controllers/variant.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/product/:productId', variantController.getAllVariants);
router.get('/:id', variantController.getVariant);

router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin', 'vendor'));

router.post('/', variantController.createVariant);
router.patch('/:id', variantController.updateVariant);
router.delete('/:id', authMiddleware.restrictTo('admin'), variantController.deleteVariant);

module.exports = router;
