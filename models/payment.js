const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Razorpay Identifiers
  razorpayPaymentId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  razorpayOrderId: { 
    type: String, 
    required: true 
  },
  razorpaySignature: { 
    type: String 
  },
  
  // Order Reference
  orderId: { 
    type: String, 
    required: true, 
    ref: 'Order' 
  },
  
  // Payment Details
  amount: { 
    type: Number, 
    required: true 
  }, // in paise
  currency: { 
    type: String, 
    default: 'INR' 
  },
  method: { 
    type: String 
  }, // card, upi, netbanking, wallet
  bank: { 
    type: String 
  }, // bank name if applicable
  wallet: { 
    type: String 
  }, // wallet name if applicable
  vpa: { 
    type: String 
  }, // UPI ID if applicable
  
  // Card Details (for tracking, not storing sensitive data)
  card: {
    network: { type: String }, // visa, mastercard, rupay
    type: { type: String }, // credit, debit
    issuer: { type: String }, // bank name
    last4: { type: String } // last 4 digits only
  },
  
  // Payment Status
  status: { 
    type: String, 
    enum: [
      'created', 
      'authorized', 
      'captured', 
      'refunded', 
      'failed', 
      'pending'
    ], 
    default: 'created' 
  },
  
  // Refund Information
  refunds: [{
    refundId: { type: String },
    amount: { type: Number },
    reason: { type: String },
    status: { 
      type: String, 
      enum: ['processed', 'pending', 'failed'] 
    },
    processedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Customer Information
  customer: {
    email: { type: String, required: true },
    phone: { type: String },
    name: { type: String }
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  capturedAt: { 
    type: Date 
  },
  
  // Error Information (if payment failed)
  error: {
    code: { type: String },
    description: { type: String },
    source: { type: String },
    step: { type: String },
    reason: { type: String }
  },
  
  // Metadata
  notes: {
    order_items: { type: String },
    customer_notes: { type: String },
    internal_notes: { type: String }
  },
  
  // Fraud Detection
  risk: {
    score: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    reasons: [{ type: String }]
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ 'customer.email': 1 });
paymentSchema.index({ status: 1 });

// Static method to find by Razorpay payment ID
paymentSchema.statics.findByRazorpayId = function(paymentId) {
  return this.findOne({ razorpayPaymentId: paymentId });
};

// Static method to get payments by customer email
paymentSchema.statics.findByCustomerEmail = function(email) {
  return this.find({ 'customer.email': email }).sort({ createdAt: -1 });
};

// Instance method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.status === 'captured';
};

// Instance method to check if payment can be refunded
paymentSchema.methods.canRefund = function() {
  return this.status === 'captured' && this.refunds.length === 0;
};

// Instance method to calculate refundable amount
paymentSchema.methods.getRefundableAmount = function() {
  const totalRefunded = this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return this.amount - totalRefunded;
};

// Instance method to add refund
paymentSchema.methods.addRefund = function(refundData) {
  this.refunds.push(refundData);
  if (refundData.amount === this.amount) {
    this.status = 'refunded';
  }
  return this.save();
};

// Virtual for amount in rupees (for display)
paymentSchema.virtual('amountInRupees').get(function() {
  return this.amount / 100;
});

// Transform output to include virtuals
paymentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
/payments.jsconst express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ SIMPLE & CLEAN PAYMENT VERIFICATION
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 Payment verification started');
    
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature 
    } = req.body;

    // 1. Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.log('❌ Signature mismatch');
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    console.log('✅ Signature verified');

    // 2. Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status === 'captured') {
      console.log('✅ Payment captured successfully');
      
      // ✅ SUCCESS RESPONSE - No database saving for now
      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });
      
    } else {
      console.log('❌ Payment not captured:', payment.status);
      res.status(400).json({
        success: false,
        error: `Payment failed with status: ${payment.status}`
      });
    }

  } catch (error) {
    console.error('💥 Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed'
    });
  }
});

// ✅ SIMPLE ORDER CREATION
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      payment_capture: 1
    });

    console.log('✅ Razorpay order created:', order.id);
    
    res.json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Order creation failed'
    });
  }
});

// Health check
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payments API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; this is backend/utils
/paymentHelper.js  // Payment Utility Functions
const Razorpay = require('razorpay');
//const Payment = require('../models/Payment');

class PaymentHelper {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create Razorpay order
  // In backend/utils/paymentHelper.js - Updated createRazorpayOrder function

async createRazorpayOrder(orderData) {
  try {
    const { amount, currency, receipt, notes } = orderData;

    const options = {
      amount: Math.round(amount), // in paise
      currency: currency || 'INR',
      receipt: receipt,
      notes: notes,
      payment_capture: 1 // ✅ Set to 1 for automatic capture [citation:7]
    };

    const order = await this.razorpay.orders.create(options);
    
    console.log(`✅ Razorpay order created with AUTO-CAPTURE: ${order.id}`);
    
    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    };

  } catch (error) {
    console.error('❌ Razorpay order creation failed:', error);
    return {
      success: false,
      error: error.error?.description || error.message
    };
  }
}

  

  // Verify payment signature
  verifyPaymentSignature(paymentData) {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;
    
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    
    if (!isValid) {
      console.error('❌ Payment signature verification failed');
    }

    return isValid;
  }

  // Get payment details from Razorpay
  async getPaymentDetails(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('❌ Failed to fetch payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process refund
  async processRefund(paymentId, amount, reason = 'customer_request') {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100), // convert to paise
        notes: { reason }
      });

      console.log(`✅ Refund processed: ${refund.id}`);
      
      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100 // convert to rupees
      };

    } catch (error) {
      console.error('❌ Refund failed:', error);
      
      return {
        success: false,
        error: error.error?.description || error.message
      };
    }
  }

  // Check payment status
  async checkPaymentStatus(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      return {
        success: true,
        status: payment.status,
        amount: payment.amount / 100,
        method: payment.method,
        captured: payment.captured
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate GST for items
  calculateGST(items) {
    const gstSlabs = {
      low: { threshold: 2500, rate: 0.05 },  // 5% GST for ≤ ₹2,500
      high: { threshold: 2501, rate: 0.18 }  // 18% GST for > ₹2,500
    };

    let totalTax = 0;
    let tax5 = 0;
    let tax18 = 0;

    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      const taxRate = item.price <= gstSlabs.low.threshold ? 
        gstSlabs.low.rate : gstSlabs.high.rate;
      
      const itemTax = itemTotal * taxRate;
      totalTax += itemTax;

      if (taxRate === gstSlabs.low.rate) {
        tax5 += itemTax;
      } else {
        tax18 += itemTax;
      }
    });

    return {
      totalTax: Math.round(totalTax),
      tax5: Math.round(tax5),
      tax18: Math.round(tax18),
      hasMixedRates: tax5 > 0 && tax18 > 0
    };
  }

  // Generate order summary for payment
  generateOrderSummary(order) {
    const subtotal = order.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );

    const taxDetails = this.calculateGST(order.items);
    const total = subtotal + taxDetails.totalTax + (order.deliveryCharge || 0);

    return {
      subtotal: Math.round(subtotal),
      taxAmount: taxDetails.totalTax,
      taxDetails,
      deliveryCharge: order.deliveryCharge || 0,
      total: Math.round(total),
      currency: 'INR'
    };
  }

  // Validate payment data
  validatePaymentData(paymentData) {
    const errors = [];

    if (!paymentData.razorpay_payment_id) {
      errors.push('Payment ID is required');
    }

    if (!paymentData.razorpay_order_id) {
      errors.push('Order ID is required');
    }

    if (!paymentData.razorpay_signature) {
      errors.push('Payment signature is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get payment analytics
/*  async getPaymentAnalytics(timeframe = '30d') {
    const dateRange = this.getDateRange(timeframe);

    const paymentStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const methodStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'captured'
        }
      },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return {
      paymentStats,
      methodStats,
      timeframe
    };
  }
*/
  // Helper function for date ranges
  getDateRange(timeframe) {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
      case '1y': start.setFullYear(end.getFullYear() - 1); break;
      default: start.setDate(end.getDate() - 30);
    }
    
    return { start, end };
  }
}








module.exports = PaymentHelper;





