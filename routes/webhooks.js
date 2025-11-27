const express = require('express');
const router = express.Router();
const Order = require('../models/order');

// ✅ RAZORPAY WEBHOOK HANDLER
router.post('/razorpay', express.raw({type: 'application/json'}), (req, res) => {
  const crypto = require('crypto');
  
  const signature = req.headers['x-razorpay-signature'];
  
  // ✅ Get secret from environment variable
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  // Check if secret is configured
  if (!secret) {
    console.error('❌ Webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('❌ Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  console.log(`✅ Webhook received: ${event.event}`);
  
  // Handle different webhook events
  switch (event.event) {
    case 'payment.captured':
      handlePaymentCaptured(event);
      break;
    case 'payment.failed':
      handlePaymentFailed(event);
      break;
    case 'refund.processed':
      handleRefundProcessed(event);
      break;
    default:
      console.log('Unhandled webhook event:', event.event);
  }

  res.json({ status: 'ok' });
});

async function handlePaymentCaptured(event) {
  try {
    const payment = event.payload.payment.entity;
    
    // Update order status in database
    await Order.findOneAndUpdate(
      { razorpayOrderId: payment.order_id },
      {
        paymentStatus: 'paid',
        razorpayPaymentId: payment.id,
        status: 'confirmed',
        $push: {
          timeline: {
            status: 'paid',
            description: 'Payment captured via webhook',
            timestamp: new Date()
          }
        }
      }
    );
    
    console.log(`✅ Payment captured for order: ${payment.order_id}`);
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
}

async function handlePaymentFailed(event) {
  try {
    const payment = event.payload.payment.entity;
    
    await Order.findOneAndUpdate(
      { razorpayOrderId: payment.order_id },
      {
        paymentStatus: 'failed',
        status: 'cancelled',
        $push: {
          timeline: {
            status: 'failed',
            description: `Payment failed: ${payment.error_description || 'Unknown error'}`,
            timestamp: new Date()
          }
        }
      }
    );
    
    console.log(`❌ Payment failed for order: ${payment.order_id}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleRefundProcessed(event) {
  try {
    const refund = event.payload.refund.entity;
    
    await Order.findOneAndUpdate(
      { razorpayPaymentId: refund.payment_id },
      {
        paymentStatus: 'refunded',
        $push: {
          timeline: {
            status: 'refunded',
            description: `Refund processed: ₹${refund.amount / 100}`,
            timestamp: new Date()
          }
        }
      }
    );
    
    console.log(`💰 Refund processed for payment: ${refund.payment_id}`);
  } catch (error) {
    console.error('Error handling refund:', error);
  }
}

module.exports = router;
