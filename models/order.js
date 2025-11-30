const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  razorpayOrderId: { type: String }, // Razorpay's order ID
  razorpayPaymentId: { type: String }, // Razorpay's payment ID
  
  customer: {
    userId: { type: String, default: '' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' }
  },
  
  shippingAddress: {
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  items: [{
    _id: { type: mongoose.Schema.Types.Mixed }, // ✅ Accept both ObjectId and strings
    productId: { type: mongoose.Schema.Types.Mixed, required: true }, // ✅ Accept numbers and strings
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    image: { type: String, default: '' }
  }],
  
  pricing: {
    subtotal: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
    taxDetails: {
      gst5: { type: Number, default: 0 },
      gst18: { type: Number, default: 0 }
    },
    deliveryCharge: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 }
  },
  
  shipping: {
    method: { type: String, default: 'standard' },
    provider: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    estimatedDelivery: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date }
  },
  
  // ✅ FIXED: Simple string status for now to resolve the validation error
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // ✅ FIXED: Separate payment status field
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentMethod: { 
    type: String, 
    enum: ['razorpay', 'cod'], 
    required: true,
    default: 'razorpay'
  },
  
  notes: {
    customer: { type: String, default: '' },
    admin: { type: String, default: '' }
  },
  
  timeline: [{
    status: { type: String, required: true },
    description: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // ✅ Added payment date field
  paidAt: { type: Date }
  
}, { 
  timestamps: true 
});

// Add timeline entry when status changes
orderSchema.methods.addTimelineEvent = function(status, description) {
  this.timeline.push({
    status,
    description,
    timestamp: new Date()
  });
};

// Indexes for better performance
orderSchema.index({ orderId: 1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
