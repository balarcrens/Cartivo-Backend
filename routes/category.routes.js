const express = require('express');
const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.route('/')
    .get(categoryController.getAllCategories)
    .post(authMiddleware.protect, authMiddleware.restrictTo('admin'), categoryController.createCategory);

router.get('/tree', categoryController.getCategoryTree);
router.get('/slug/:slug', categoryController.getCategoryBySlug);


router.route('/:id')
    .patch(authMiddleware.protect, authMiddleware.restrictTo('admin'), categoryController.updateCategory)
    .delete(authMiddleware.protect, authMiddleware.restrictTo('admin'), categoryController.deleteCategory);

module.exports = router;
