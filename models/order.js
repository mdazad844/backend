const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  razorpayOrderId: { type: String }, // Razorpay's order ID
  razorpayPaymentId: { type: String }, // Razorpay's payment ID
  
  customer: {
    userId: { type: String },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },
  
  shippingAddress: {
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    size: { type: String },
    color: { type: String },
    image: { type: String }
  }],
  
  pricing: {
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    taxDetails: {
      gst5: { type: Number, default: 0 },
      gst18: { type: Number, default: 0 }
    },
    deliveryCharge: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  
  shipping: {
    method: { type: String },
    provider: { type: String },
    trackingNumber: { type: String },
    estimatedDelivery: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date }
  },
  
  status: {
    payment: { 
      type: String, 
      enum: ['pending', 'paid', 'failed', 'refunded'], 
      default: 'pending' 
    },
    order: { 
      type: String, 
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], 
      default: 'pending' 
    }
  },
  
  paymentMethod: { 
    type: String, 
    enum: ['razorpay', 'cod'], 
    required: true 
  },
  
  notes: {
    customer: { type: String },
    admin: { type: String }
  },
  
  timeline: [{
    status: { type: String, required: true },
    description: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
  
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


module.exports = mongoose.model('order', orderSchema);
