// Business Analytics and Reporting Utilities
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');

class Analytics {
  // Sales Analytics
  static async getSalesAnalytics(timeframe = '30d') {
    const dateRange = this.getDateRange(timeframe);
    
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          'status.payment': 'paid'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          totalSales: { $sum: "$pricing.total" },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: "$pricing.total" },
          itemsSold: { $sum: { $size: "$items" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const summary = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          totalOrders: { $sum: 1 },
          paidOrders: {
            $sum: { $cond: [{ $eq: ["$status.payment", "paid"] }, 1, 0] }
          },
          codOrders: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "cod"] }, 1, 0] }
          },
          averageOrderValue: { $avg: "$pricing.total" }
        }
      }
    ]);

    return {
      timeframe,
      salesData,
      summary: summary[0] || {},
      dateRange
    };
  }

  // Product Performance Analytics
  static async getProductAnalytics() {
    const topProducts = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          averagePrice: { $avg: "$items.price" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    const lowStockProducts = await Product.find({
      'inventory.trackQuantity': true,
      'inventory.quantity': { $lte: 10 }
    }).select('name inventory.quantity price');

    return {
      topProducts,
      lowStockProducts,
      totalProducts: topProducts.length
    };
  }

  // Customer Analytics
  static async getCustomerAnalytics() {
    const customerData = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: "$customer.email",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$pricing.total" },
          firstOrderDate: { $min: "$createdAt" },
          lastOrderDate: { $max: "$createdAt" }
        }
      },
      {
        $project: {
          email: "$_id",
          totalOrders: 1,
          totalSpent: 1,
          firstOrderDate: 1,
          lastOrderDate: 1,
          customerSince: "$firstOrderDate",
          averageOrderValue: { $divide: ["$totalSpent", "$totalOrders"] }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 20 }
    ]);

    const newCustomers = await Order.aggregate([
      {
        $match: {
          'status.payment': 'paid',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: "$customer.email",
          firstOrderDate: { $min: "$createdAt" }
        }
      },
      {
        $match: {
          $expr: {
            $eq: [
              { $dateToString: { format: "%Y-%m-%d", date: "$firstOrderDate" } },
              { $dateToString: { format: "%Y-%m-%d", date: "$$NOW" } }
            }
          }
        }
      }
    ]);

    return {
      topCustomers: customerData,
      newCustomers: newCustomers.length,
      totalCustomers: customerData.length
    };
  }

  // Geographic Analytics
  static async getGeographicAnalytics() {
    const geographicData = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: "$shippingAddress.state",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
          averageOrderValue: { $avg: "$pricing.total" }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const cityData = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: {
            state: "$shippingAddress.state",
            city: "$shippingAddress.city"
          },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 20 }
    ]);

    return {
      byState: geographicData,
      byCity: cityData
    };
  }

  // Payment Method Analytics
  static async getPaymentAnalytics() {
    const paymentMethods = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: "$paymentMethod",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" },
          successRate: { 
            $avg: { 
              $cond: [{ $eq: ["$status.payment", "paid"] }, 1, 0] 
            } 
          }
        }
      }
    ]);

    const dailyRevenue = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: "$pricing.total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    return {
      paymentMethods,
      dailyRevenue,
      totalPaymentMethods: paymentMethods.length
    };
  }

  // Helper function to calculate date ranges
  static getDateRange(timeframe) {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }
    
    return { start, end };
  }

  // Real-time Dashboard Stats
  static async getDashboardStats() {
    const [
      totalOrders,
      totalRevenue,
      todayOrders,
      pendingOrders,
      lowStockCount,
      totalProducts
    ] = await Promise.all([
      Order.countDocuments({ 'status.payment': 'paid' }),
      Order.aggregate([
        { $match: { 'status.payment': 'paid' } },
        { $group: { _id: null, total: { $sum: "$pricing.total" } } }
      ]),
      Order.countDocuments({
        'status.payment': 'paid',
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
      }),
      Order.countDocuments({ 'status.order': 'pending' }),
      Product.countDocuments({
        'inventory.trackQuantity': true,
        'inventory.quantity': { $lte: 10 }
      }),
      Product.countDocuments({ status: 'active' })
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayOrders,
      pendingOrders,
      lowStockCount,
      totalProducts,
      updatedAt: new Date()
    };
  }
}

module.exports = Analytics;