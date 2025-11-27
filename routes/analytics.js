const express = require('express');
const router = express.Router();
const Order = require('../models/order');

// ✅ SALES ANALYTICS
router.get('/sales', async (req, res) => {
  try {
    const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y
    
    const dateRange = getDateRange(period);
    
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
          averageOrder: { $avg: "$pricing.total" }
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
          }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      salesData,
      summary: summary[0] || {}
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ PRODUCT ANALYTICS
router.get('/products', async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      topProducts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GEOGRAPHIC ANALYTICS
router.get('/geographic', async (req, res) => {
  try {
    const geographicData = await Order.aggregate([
      { $match: { 'status.payment': 'paid' } },
      {
        $group: {
          _id: "$shippingAddress.state",
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$pricing.total" }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      geographicData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
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


module.exports = router;
