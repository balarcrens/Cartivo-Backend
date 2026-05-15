const express = require('express');
const productController = require('../controllers/product.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router
    .route('/')
    .get(productController.getAllProducts)
    .post(
        authMiddleware.protect,
        authMiddleware.restrictTo('admin', 'vendor'),
        productController.createProduct
    );

router
    .route('/:id')
    .get(productController.getProduct)
    .patch(
        authMiddleware.protect,
        authMiddleware.restrictTo('admin', 'vendor'),
        productController.updateProduct
    )
    .delete(
        authMiddleware.protect,
        authMiddleware.restrictTo('admin'),
        productController.deleteProduct
    );

router.get('/slug/:slug', productController.getProductBySlug);


module.exports = router;
