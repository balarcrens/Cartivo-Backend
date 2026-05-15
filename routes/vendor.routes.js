const express = require('express');
const vendorController = require('../controllers/vendor.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/register', vendorController.registerVendor);
router.get('/me', vendorController.getVendorProfile);
router.patch('/me', vendorController.updateVendorProfile);

router.use(authMiddleware.restrictTo('admin'));
router.get('/all', vendorController.getAllVendors);
router.patch('/verify/:id', vendorController.verifyVendor);

module.exports = router;
