const express = require('express');
const { getWishlist, toggleWishlist } = require('../controllers/wishlistController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/', getWishlist);
router.post('/toggle', toggleWishlist);

module.exports = router;