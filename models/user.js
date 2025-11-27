const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Authentication
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String 
  }, // Hashed password (if using local auth)
  
  // Profile Information
  profile: {
    name: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String }
  },
  
  // Addresses
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false }
  }],
  
  // Preferences
  preferences: {
    newsletter: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true }
  },
  
  // Order History (references)
  orders: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order' 
  }],
  
  // Wishlist
  wishlist: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  }],
  
  // Cart (stored temporarily)
  cart: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    image: { type: String },
    size: { type: String },
    color: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Account Status
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended'], 
    default: 'active' 
  },
  
  // Authentication
  auth: {
    provider: { 
      type: String, 
      enum: ['local', 'google', 'facebook'], 
      default: 'local' 
    },
    providerId: { type: String }, // For OAuth providers
    lastLogin: { type: Date },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String }
  },
  
  // Statistics
  statistics: {
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderDate: { type: Date }
  }
  
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'profile.phone': 1 });
userSchema.index({ status: 1 });

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Instance method to get default address
userSchema.methods.getDefaultAddress = function() {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
};

// Instance method to add address
userSchema.methods.addAddress = function(addressData) {
  // If this is the first address, set as default
  if (this.addresses.length === 0) {
    addressData.isDefault = true;
  }
  
  this.addresses.push(addressData);
  return this.save();
};

// Instance method to update order statistics
userSchema.methods.updateOrderStats = function(orderAmount) {
  this.statistics.totalOrders += 1;
  this.statistics.totalSpent += orderAmount;
  this.statistics.lastOrderDate = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);