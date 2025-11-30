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
