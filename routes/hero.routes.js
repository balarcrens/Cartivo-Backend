const express = require('express');
const heroController = require('../controllers/hero.controller');
const { protect, restrictTo } = require('../middlewares/auth');

const router = express.Router();

router.get('/', heroController.getAllBanners);

router.use(protect);
router.use(restrictTo('admin'));

router.post('/', heroController.createBanner);
router.patch('/:id', heroController.updateBanner);
router.delete('/:id', heroController.deleteBanner);

module.exports = router;
