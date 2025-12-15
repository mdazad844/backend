const express = require('express');
const router = express.Router();
const Order = require('../models/order');

// Enable CORS
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Get all orders (for admin)
router.get('/all-orders', async (req, res) => {
  try {
    console.log('📋 Fetching all orders from database...');
    
    const orders = await Order.find().sort({ createdAt: -1 });
    
    console.log(`✅ Found ${orders.length} orders`);
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        customer: {
          name: order.customer?.name || 'Customer',
          email: order.customer?.email || 'No email',
          phone: order.customer?.phone || 'No phone'
        },
        items: order.items?.map(item => ({
          name: item.name || 'Product',
          quantity: item.quantity || 1,
          price: item.price || 0,
          total: (item.price || 0) * (item.quantity || 1)
        })) || [],
        pricing: order.pricing || {
          subtotal: 0,
          deliveryCharge: 0,
          taxAmount: 0,
          total: 0
        },
        shippingAddress: order.shippingAddress || {
          line1: 'No address',
          city: '',
          state: '',
          pincode: ''
        },
        status: order.status || 'pending',
        paymentStatus: order.paymentStatus || 'unknown',
        paymentMethod: order.paymentMethod || 'unknown',
        createdAt: order.createdAt,
        paidAt: order.paidAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch orders from database'
    });
  }
});

// Get orders by user email
router.post('/user-orders', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    console.log(`📧 Fetching orders for: ${email}`);
    
    const orders = await Order.find({ 
      'customer.email': email 
    }).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${orders.length} orders for ${email}`);
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        customer: order.customer,
        items: order.items,
        pricing: order.pricing,
        shippingAddress: order.shippingAddress,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        timeline: order.timeline
      }))
    });
    
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get single order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        customer: order.customer,
        items: order.items,
        pricing: order.pricing,
        shippingAddress: order.shippingAddress,
        shipping: order.shipping,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paidAt: order.paidAt,
        timeline: order.timeline,
        createdAt: order.createdAt
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Get order count
router.get('/count', async (req, res) => {
  try {
    const count = await Order.countDocuments();
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check for orders API
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Orders Dashboard API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
