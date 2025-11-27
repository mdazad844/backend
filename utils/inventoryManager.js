// Inventory Management Utilities
const Product = require('../models/Product');

class InventoryManager {
  // Update inventory when order is placed
  static async updateInventory(items, operation = 'decrement') {
    try {
      const updates = [];
      
      for (const item of items) {
        const product = await Product.findOne({ productId: item.productId });
        
        if (!product) {
          console.warn(`⚠️ Product not found: ${item.productId}`);
          continue;
        }

        if (product.inventory.trackQuantity) {
          const quantityChange = operation === 'decrement' ? -item.quantity : item.quantity;
          product.inventory.quantity += quantityChange;

          // Ensure inventory doesn't go negative
          if (product.inventory.quantity < 0) {
            product.inventory.quantity = 0;
            console.warn(`⚠️ Inventory underflow prevented for ${product.name}`);
          }

          updates.push(product.save());
        }
      }

      await Promise.all(updates);
      console.log(`✅ Inventory updated for ${updates.length} products`);
      
    } catch (error) {
      console.error('❌ Inventory update failed:', error);
      throw error;
    }
  }

  // Check stock availability before order
  static async checkStockAvailability(items) {
    const stockCheck = {
      available: true,
      outOfStock: [],
      lowStock: []
    };

    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      
      if (!product) {
        stockCheck.available = false;
        stockCheck.outOfStock.push({
          productId: item.productId,
          name: item.name,
          reason: 'Product not found'
        });
        continue;
      }

      if (product.inventory.trackQuantity && !product.inventory.allowOutOfStock) {
        if (product.inventory.quantity < item.quantity) {
          stockCheck.available = false;
          stockCheck.outOfStock.push({
            productId: item.productId,
            name: product.name,
            requested: item.quantity,
            available: product.inventory.quantity,
            reason: 'Insufficient stock'
          });
        } else if (product.inventory.quantity <= product.inventory.lowStockAlert) {
          stockCheck.lowStock.push({
            productId: item.productId,
            name: product.name,
            current: product.inventory.quantity,
            alertLevel: product.inventory.lowStockAlert
          });
        }
      }
    }

    return stockCheck;
  }

  // Get low stock alerts
  static async getLowStockAlerts() {
    return await Product.find({
      'inventory.trackQuantity': true,
      'inventory.quantity': { $lte: 10 }
    }).select('name inventory.quantity inventory.lowStockAlert price');
  }

  // Restock products
  static async restockProduct(productId, quantity, reason = 'manual_restock') {
    const product = await Product.findOne({ productId });
    
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    if (product.inventory.trackQuantity) {
      product.inventory.quantity += quantity;
      await product.save();

      console.log(`✅ Restocked ${product.name}: +${quantity} units (Reason: ${reason})`);
      
      return {
        success: true,
        product: product.name,
        newQuantity: product.inventory.quantity,
        added: quantity
      };
    }

    return {
      success: false,
      error: 'Product does not track inventory'
    };
  }

  // Get inventory summary
  static async getInventorySummary() {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalInventoryValue: {
            $sum: {
              $multiply: ['$price', '$inventory.quantity']
            }
          },
          outOfStock: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    '$inventory.trackQuantity',
                    { $eq: ['$inventory.quantity', 0] }
                  ]
                }, 
                1, 
                0 
              ]
            }
          },
          lowStock: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    '$inventory.trackQuantity',
                    { $lte: ['$inventory.quantity', 10] },
                    { $gt: ['$inventory.quantity', 0] }
                  ]
                }, 
                1, 
                0 
              ]
            }
          }
        }
      }
    ]);

    const topProducts = await Product.find()
      .sort({ 'inventory.quantity': 1 })
      .limit(10)
      .select('name inventory.quantity price');

    return {
      ...summary[0],
      topProducts
    };
  }

  // Bulk inventory update
  static async bulkInventoryUpdate(updates) {
    const results = {
      successful: [],
      failed: []
    };

    for (const update of updates) {
      try {
        const result = await this.restockProduct(
          update.productId, 
          update.quantity, 
          update.reason
        );
        results.successful.push(result);
      } catch (error) {
        results.failed.push({
          productId: update.productId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = InventoryManager;