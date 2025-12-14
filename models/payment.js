// backend/models/payment.js - UPDATED SCHEMA
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
    unique: true
  },
  
  // Order Number (Human readable)
  orderNumber: {
    type: String,
    default: function() {
      return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
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
  },
  bank: { 
    type: String 
  },
  
  // Customer Information
  customer: {
    userId: { type: String },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  
  // Shipping Address
  shippingAddress: {
    name: { type: String },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    landmark: { type: String },
    phone: { type: String }
  },
  
  // Order Items (Complete details)
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String },
    color: { type: String },
    image: { type: String },
    category: { type: String }
  }],
  
  // Financial Breakdown
  financials: {
    subtotal: { type: Number, required: true },
    deliveryCharge: { type: Number, default: 0 },
    taxAmount: { type: Number, required: true }, // 5% GST
    grandTotal: { type: Number, required: true } // Total including GST
  },
  
  // Order Status
  status: { 
    type: String, 
    enum: [
      'pending',       // Order created, payment pending
      'confirmed',     // Payment successful
      'processing',    // Order being processed
      'shipped',       // Order shipped
      'delivered',     // Order delivered
      'cancelled',     // Order cancelled
      'refunded'       // Payment refunded
    ], 
    default: 'pending' 
  },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Fulfillment Tracking
  fulfillment: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    trackingNumber: { type: String },
    carrier: { type: String },
    shippedDate: { type: Date },
    deliveredDate: { type: Date }
  },
  
  // Delivery Information
  delivery: {
    method: { type: String, default: 'Standard Delivery' },
    estimatedDelivery: { type: Date },
    actualDelivery: { type: Date }
  },
  
  // Customer Notes
  notes: {
    customerNotes: { type: String },
    internalNotes: { type: String }
  },
  
  // Timestamps
  orderDate: { 
    type: Date, 
    default: Date.now 
  },
  paymentDate: { 
    type: Date 
  },
  
  // Refunds (if any)
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
  }]
}, {
  timestamps: true
});

// Indexes for faster queries
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ 'customer.email': 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ orderNumber: 1 });

// Virtual for amount in rupees (for display)
paymentSchema.virtual('amountInRupees').get(function() {
  return this.amount / 100;
});

// Virtual for financials in rupees
paymentSchema.virtual('financialsInRupees').get(function() {
  if (!this.financials) return null;
  return {
    subtotal: this.financials.subtotal / 100,
    deliveryCharge: this.financials.deliveryCharge / 100,
    taxAmount: this.financials.taxAmount / 100,
    grandTotal: this.financials.grandTotal / 100
  };
});

// Static method to find by customer email
paymentSchema.statics.findByCustomerEmail = function(email) {
  return this.find({ 'customer.email': email })
    .sort({ createdAt: -1 })
    .select('-razorpaySignature -__v');
};

// Instance method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.paymentStatus === 'paid';
};

// Transform output
paymentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.razorpaySignature;
    return ret;
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
