const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Order = require('../models/order');
const Payment = require('../models/payment'); // ← NOW USING PAYMENT MODEL

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ ENHANCED PAYMENT VERIFICATION WITH PAYMENT MODEL

router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = req.body;

    console.log('🔍 Verifying payment:', { razorpay_payment_id, razorpay_order_id, order_id });

    // Signature verification
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Signature verification failed');
      
      // Create failed payment record
      await Payment.create({
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        status: 'failed',
        error: {
          code: 'INVALID_SIGNATURE',
          description: 'Payment signature verification failed',
          step: 'verification'
        }
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Get payment details from Razorpay
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    console.log('📊 Payment details from Razorpay:', paymentDetails.status);
    
    // Find the associated order - try multiple ways
    let order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    
    // If not found by razorpayOrderId, try by order_id from frontend
    if (!order && order_id) {
      order = await Order.findOne({ orderId: order_id });
    }
    
    if (!order) {
      console.error('❌ Order not found for:', { razorpay_order_id, order_id });
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    console.log('✅ Order found:', order.orderId);

    // Create payment record
    const payment = new Payment({
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      orderId: order.orderId,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      method: paymentDetails.method,
      bank: paymentDetails.bank,
      wallet: paymentDetails.wallet,
      vpa: paymentDetails.vpa,
      status: 'captured',
      customer: {
        email: order.customer?.email || 'unknown@example.com',
        phone: order.customer?.phone || '',
        name: order.customer?.name || 'Customer'
      },
      capturedAt: new Date()
    });

    // Add card details if payment was by card
    if (paymentDetails.method === 'card' && paymentDetails.card) {
      payment.card = {
        network: paymentDetails.card.network,
        type: paymentDetails.card.type,
        issuer: paymentDetails.card.issuer,
        last4: paymentDetails.card.last4
      };
    }

    await payment.save();
    console.log('✅ Payment record created:', payment.razorpayPaymentId);

    // ✅ FIXED: Update order status using standard fields
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.paidAt = new Date();
    
    // If order doesn't have these fields, use whatever status fields exist
    if (order.status) {
      order.status = 'confirmed';
    }
    if (order.paymentStatus) {
      order.paymentStatus = 'paid';
    }

    await order.save();
    console.log('✅ Order updated:', order.orderId);

    res.json({
      success: true,
      message: 'Payment verified and order confirmed',
      orderId: order.orderId,
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error('❌ Payment verification failed:', error);
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

// ✅ FIXED: CREATE ORDER ENDPOINT USING PAYMENTHELPER
router.post('/create-order', async (req, res) => {
  try {
    console.log('🔄 Creating Razorpay order...', req.body);
    
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required'
      });
    }

    // ✅ USE PAYMENTHELPER INSTEAD OF DIRECT RAZORPAY
    const PaymentHelper = require('../utils/paymentHelper');
    const paymentHelper = new PaymentHelper();
    
    const orderData = {
      amount: Math.round(amount), // amount in paise (already converted by frontend)
      currency: currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    };
    
    console.log('📦 Creating Razorpay order with:', orderData);
    
    // Create Razorpay order using PaymentHelper
    const order = await paymentHelper.createRazorpayOrder(orderData);
    
    if (order.success) {
      console.log('✅ Razorpay order created:', order.orderId);
      
      // ✅ RETURN THE CORRECT FORMAT THAT FRONTEND EXPECTS
      res.json({
        success: true,
        razorpayOrderId: order.orderId, // Frontend expects this exact field name
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
// Add base GET route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Payments API is working',
    endpoints: {
      'POST /verify-payment': 'Verify Razorpay payment',
      'POST /create-order': 'Create Razorpay order (to be added)',
      'GET /:paymentId': 'Get payment details',
      'GET /customer/:email': 'Get customer payments'
    }
  });
});

// Mock payment verification for testing
router.post('/verify-payment-test', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Mock successful verification for testing
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





