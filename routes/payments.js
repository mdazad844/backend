const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Order = require('../models/order');
const Payment = require('../models/payment');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ FIXED VERIFICATION ENDPOINT - USES order_data FROM FRONTEND
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 BACKEND VERIFICATION DEBUG START ==========');
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature, 
      order_id,
      order_data
    } = req.body;

    console.log('🔍 Received verification request:', { 
      razorpay_payment_id, 
      razorpay_order_id, 
      order_id,
      has_order_data: !!order_data
    });

    if (order_data) {
      console.log('📦 Order data received:', {
        items_count: order_data.items?.length || 0,
        pricing: order_data.pricing,
        shippingAddress: order_data.shippingAddress,
        paymentMethod: order_data.paymentMethod,
        customer: order_data.customer
      });
    }

    // Signature verification
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    console.log('🔐 Signature verification:', {
      received: razorpay_signature,
      expected: expectedSignature,
      match: expectedSignature === razorpay_signature
    });

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Signature verification failed');
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    console.log('✅ Signature verification passed');

    // Get payment details from Razorpay
    console.log('🔍 Fetching payment details from Razorpay...');
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    console.log('📊 Razorpay payment details:', paymentDetails.status);
    
    // Order creation/retrieval logic
    let order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    
    if (!order && order_id) {
      order = await Order.findOne({ orderId: order_id });
    }
    
    if (!order) {
      console.log('🔄 Creating new order in database...');
      
      order = new Order({
        orderId: order_data?.orderId || order_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: paymentDetails.amount / 100,
        currency: paymentDetails.currency,
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: order_data?.paymentMethod || 'razorpay',
        paidAt: new Date(),
        customer: order_data?.customer || {
          email: paymentDetails.email || 'customer@example.com',
          name: 'Customer'
        },
        items: order_data?.items || [],
        pricing: order_data?.pricing || {
          subtotal: paymentDetails.amount / 100,
          taxAmount: 0,
          deliveryCharge: 0,
          total: paymentDetails.amount / 100
        },
        address: order_data?.shippingAddress || {
          line1: 'Default Address',
          city: 'Default City',
          state: 'Default State',
          pincode: '000000',
          country: 'India'
        }
      });
      
      console.log('💾 Saving order to database...');
      await order.save();
      console.log('✅ Order created successfully:', order.orderId);
    } else {
      console.log('✅ Order found in database:', order.orderId);
    }

    // Create payment record
    console.log('💾 Creating payment record...');
    const payment = new Payment({
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      orderId: order.orderId,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      method: paymentDetails.method,
      status: 'captured',
      customer: {
        email: order.customer?.email || 'unknown@example.com',
        name: order.customer?.name || 'Customer'
      },
      capturedAt: new Date()
    });

    await payment.save();
    console.log('✅ Payment record created');

    // Update order status
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.paidAt = new Date();

    await order.save();
    console.log('✅ Order updated successfully');

    console.log('🎉 BACKEND VERIFICATION COMPLETED SUCCESSFULLY ==========');

    res.json({
      success: true,
      message: 'Payment verified and order confirmed',
      orderId: order.orderId,
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error('💥 BACKEND VERIFICATION FAILED:', error);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ FIXED CREATE-ORDER ENDPOINT (REMOVED order_data DEPENDENCY)
router.post('/create-order', async (req, res) => {
  try {
    console.log('🔄 Creating Razorpay order...', req.body);
    
    const { amount, currency = 'INR', receipt, notes } = req.body; // ✅ REMOVED order_data

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required'
      });
    }

    const PaymentHelper = require('../utils/paymentHelper');
    const paymentHelper = new PaymentHelper();
    
    const orderData = {
      amount: Math.round(amount),
      currency: currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    };
    
    console.log('📦 Creating Razorpay order with:', orderData);
    
    const order = await paymentHelper.createRazorpayOrder(orderData);
    
    if (order.success) {
      console.log('✅ Razorpay order created:', order.orderId);
      
      // ✅ OPTIONAL: Try to save basic order to database (won't fail if it doesn't work)
      try {
        const Order = require('../models/order');
        
        const dbOrder = new Order({
          orderId: receipt,
          razorpayOrderId: order.orderId,
          amount: order.amount / 100,
          currency: order.currency,
          status: 'created',
          paymentStatus: 'pending',
          customer: {},
          items: [],
          address: {}
        });
        
        await dbOrder.save();
        console.log('✅ Order saved to database:', dbOrder.orderId);
        
      } catch (dbError) {
        console.log('ℹ️ Order not saved to database (will be created during verification):', dbError.message);
      }
      
      res.json({
        success: true,
        razorpayOrderId: order.orderId,
        amount: order.amount,
        currency: order.currency
      });
    } else {
      console.error('❌ Razorpay order creation failed:', order.error);
      res.status(400).json({
        success: false,
        error: order.error
      });
    }
    
  } catch (error) {
    console.error('❌ Order creation endpoint failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET PAYMENT DETAILS
router.get('/:paymentId', async (req, res) => {
  try {
    const payment = await Payment.findByRazorpayId(req.params.paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET PAYMENTS BY CUSTOMER
router.get('/customer/:email', async (req, res) => {
  try {
    const payments = await Payment.findByCustomerEmail(req.params.email);
    
    res.json({
      success: true,
      payments,
      count: payments.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add base GET route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Payments API is working',
    endpoints: {
      'POST /verify-payment': 'Verify Razorpay payment',
      'POST /create-order': 'Create Razorpay order',
      'GET /:paymentId': 'Get payment details',
      'GET /customer/:email': 'Get customer payments'
    }
  });
});

// Mock payment verification for testing
router.post('/verify-payment-test', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    res.json({
      success: true,
      message: 'Payment verified successfully (TEST MODE)',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      testMode: true
    });

  } catch (error) {
    console.error('Mock payment verification failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;


