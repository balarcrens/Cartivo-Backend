const express = require('express');
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware.protect);

// Cart routes
router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.delete('/', cartController.clearCart);
router.delete('/:id', cartController.removeFromCart);
router.patch('/update-quantity', cartController.updateCartQuantity);

// Wishlist routes
router.get('/wishlist', cartController.getWishlist);
router.post('/wishlist', cartController.addToWishlist);
router.delete('/wishlist/:id', cartController.removeFromWishlist);

module.exports = router;
