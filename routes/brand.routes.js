const express = require('express');
const brandController = require('../controllers/brand.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.route('/')
    .get(brandController.getAllBrands)
    .post(authMiddleware.protect, authMiddleware.restrictTo('admin'), brandController.createBrand);

router.route('/:categoryId')
    .get(brandController.getBrandsByCategory);

router.route('/:id')
    .patch(authMiddleware.protect, authMiddleware.restrictTo('admin'), brandController.updateBrand)
    .delete(authMiddleware.protect, authMiddleware.restrictTo('admin'), brandController.deleteBrand);

module.exports = router;
