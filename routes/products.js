const express = require('express');
const { getProducts, getProduct, getFeaturedProducts, getProductsByCategory } = require('../controllers/productController');

const router = express.Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProduct);

module.exports = router;