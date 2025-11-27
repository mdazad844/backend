const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// ✅ GET ALL ORDERS (with filtering and pagination)
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentMethod,
      dateFrom,
      dateTo 
    } = req.query;

    const filter = {};
    if (status) filter['status.order'] = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET ORDER DETAILS
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ UPDATE ORDER STATUS
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { status, trackingNumber, estimatedDelivery, notes } = req.body;
    
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update status
    order.status.order = status;
    
    // Add timeline event
    order.addTimelineEvent(status, notes || `Order status updated to ${status}`);
    
    // Update shipping info if provided
    if (trackingNumber) order.shipping.trackingNumber = trackingNumber;
    if (estimatedDelivery) order.shipping.estimatedDelivery = new Date(estimatedDelivery);
    if (status === 'shipped') order.shipping.shippedAt = new Date();
    if (status === 'delivered') order.shipping.deliveredAt = new Date();

    await order.save();

    // Send notification email for shipping
    if (status === 'shipped' && trackingNumber) {
      await require('../utils/emailService').sendShippingNotification(order, trackingNumber);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        orderId: order.orderId,
        status: order.status,
        timeline: order.timeline
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ CANCEL ORDER
router.post('/:orderId/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered'].includes(order.status.order)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order with status: ${order.status.order}`
      });
    }

    order.status.order = 'cancelled';
    order.addTimelineEvent('cancelled', `Order cancelled: ${reason}`);
    
    // Restore inventory
    await require('../utils/inventoryManager').updateInventory(order.items, 'increment');
    
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;