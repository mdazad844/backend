const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Product Identification
  productId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  
  // Product Details
  category: { 
    type: String, 
    required: true 
  }, // tshirts, hoodies, etc.
  brand: { 
    type: String, 
    default: 'MyBrand' 
  },
  tags: [{ 
    type: String 
  }],
  
  // Pricing
  price: { 
    type: Number, 
    required: true 
  },
  comparePrice: { 
    type: Number 
  }, // Original price for showing discounts
  costPrice: { 
    type: Number 
  }, // For profit calculation
  
  // Inventory Management
  inventory: {
    quantity: { 
      type: Number, 
      default: 0 
    },
    trackQuantity: { 
      type: Boolean, 
      default: true 
    },
    allowOutOfStock: { 
      type: Boolean, 
      default: false 
    },
    lowStockAlert: { 
      type: Number, 
      default: 10 
    }
  },
  
  // Variants (Sizes, Colors)
  variants: [{
    size: { type: String },
    color: { type: String },
    sku: { type: String },
    price: { type: Number },
    inventory: { type: Number },
    image: { type: String }
  }],
  
  // Images
  images: [{ 
    type: String 
  }],
  primaryImage: { 
    type: String 
  },
  
  // Shipping
  weight: { 
    type: Number, 
    default: 0.3 
  }, // in kg (for shipping calculation)
  dimensions: {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number }
  },
  
  // Tax Configuration
  tax: {
    gstRate: { 
      type: Number, 
      default: 0.05 
    }, // 5% GST for apparel under ₹2500
    hsnCode: { 
      type: String 
    }
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'draft', 'archived'], 
    default: 'active' 
  },
  
  // SEO
  seo: {
    title: { type: String },
    description: { type: String },
    slug: { type: String, unique: true }
  },
  
  // Analytics
  analytics: {
    views: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    wishlists: { type: Number, default: 0 }
  }
  
}, {
  timestamps: true
});

// Indexes
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ 'inventory.quantity': 1 });
productSchema.index({ price: 1 });

// Static method to find active products
productSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to find low stock products
productSchema.statics.findLowStock = function() {
  return this.find({ 
    'inventory.trackQuantity': true,
    'inventory.quantity': { $lte: this.inventory.lowStockAlert }
  });
};

// Instance method to check if product is in stock
productSchema.methods.isInStock = function() {
  if (!this.inventory.trackQuantity) return true;
  if (this.inventory.allowOutOfStock) return true;
  return this.inventory.quantity > 0;
};

// Instance method to update inventory
productSchema.methods.updateInventory = function(quantity) {
  if (this.inventory.trackQuantity) {
    this.inventory.quantity += quantity;
  }
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);