const express = require('express');
const router = express.Router();
const {
    submitContactMessage,
    getAllContactMessages,
    updateContactStatus,
    deleteContactMessage
} = require('../controllers/contact.controller');
const { protect, restrictTo } = require('../middlewares/auth');

router.post('/', submitContactMessage);

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', getAllContactMessages);
router.patch('/:id', updateContactStatus);
router.delete('/:id', deleteContactMessage);

module.exports = router;
