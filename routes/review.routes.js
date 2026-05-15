const express = require('express');
const reviewController = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/product/:product_id', reviewController.getProductReviews);

router.post('/', authMiddleware.protect, reviewController.createReview);

module.exports = router;
