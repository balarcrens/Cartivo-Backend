const express = require('express');
const addressController = require('../controllers/address.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
    .get(addressController.getAddresses)
    .post(addressController.addAddress);

router.route('/:id')
    .patch(addressController.updateAddress)
    .delete(addressController.deleteAddress);

router.patch('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;
