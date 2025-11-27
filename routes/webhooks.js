const express = require('express');
const router = express.Router();
const Order = require('../models/order');

// ✅ RAZORPAY WEBHOOK HANDLER
router.post('/razorpay', express.raw({type: 'application/json'}), (req, res) => {
  const crypto = require('crypto');
  
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.051962@Zvmncx;
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  
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
  const payment = event.payload.payment.entity;
  
  // Update order status in database
  await Order.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      'status.payment': 'paid',
      razorpayPaymentId: payment.id,
      $push: {
        timeline: {
          status: 'paid',
          description: 'Payment captured via webhook'
        }
      }
    }
  );
  
  console.log(`✅ Payment captured for order: ${payment.order_id}`);
}

async function handlePaymentFailed(event) {
  const payment = event.payload.payment.entity;
  
  await Order.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      'status.payment': 'failed',
      $push: {
        timeline: {
          status: 'failed',
          description: `Payment failed: ${payment.error_description}`
        }
      }
    }
  );
  
  console.log(`❌ Payment failed for order: ${payment.order_id}`);
}

async function handleRefundProcessed(event) {
  const refund = event.payload.refund.entity;
  
  await Order.findOneAndUpdate(
    { razorpayPaymentId: refund.payment_id },
    {
      'status.payment': 'refunded',
      $push: {
        timeline: {
          status: 'refunded',
          description: `Refund processed: ₹${refund.amount / 100}`
        }
      }
    }
  );
}


module.exports = router;
