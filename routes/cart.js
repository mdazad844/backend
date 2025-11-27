const express = require('express');
const { getCart, addToCart } = require('../controllers/cartController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/', getCart);
router.post('/add', addToCart);

module.exports = router;