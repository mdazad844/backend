// backend/routes/orders.js - UPDATED
const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Payment = require('../models/payment');

// ✅ GET CUSTOMER ORDERS - INTELLIGENT FETCH FROM BOTH MODELS
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log('📥 Fetching orders for customer:', email);
    
    let orders = [];
    let source = '';
    
    // Try Payment model first (has more complete data)
    try {
      const payments = await Payment.find({ 'customer.email': email })
        .sort({ createdAt: -1 })
        .select('-razorpaySignature -__v');
      
      if (payments && payments.length > 0) {
        orders = payments.map(payment => ({
          orderId: payment.orderId,
          orderNumber: payment.orderNumber || payment.orderId,
          orderDate: payment.orderDate || payment.createdAt,
          status: payment.status,
          paymentStatus: payment.paymentStatus,
          items: payment.items,
          total: payment.financials?.grandTotal / 100 || payment.amount / 100,
          customer: payment.customer,
          shippingAddress: payment.shippingAddress,
          financials: payment.financialsInRupees,
          delivery: payment.delivery,
          source: 'payment_model'
        }));
        source = 'payment_model';
      }
    } catch (paymentError) {
      console.log('⚠️ Payment model query failed, trying Order model');
    }
    
    // If no orders from Payment model, try Order model
    if (orders.length === 0) {
      try {
        const orderDocs = await Order.find({ 'customer.email': email })
          .sort({ createdAt: -1 });
        
        if (orderDocs && orderDocs.length > 0) {
          orders = orderDocs.map(order => ({
            orderId: order.orderId,
            orderNumber: order.orderId,
            orderDate: order.createdAt,
            status: order.status,
            paymentStatus: order.paymentStatus,
            items: order.items,
            total: order.pricing?.total || order.pricing?.subtotal || 0,
            customer: order.customer,
            shippingAddress: order.shippingAddress,
            financials: {
              subtotal: order.pricing?.subtotal || 0,
              deliveryCharge: order.pricing?.deliveryCharge || 0,
              taxAmount: order.pricing?.taxAmount || 0,
              grandTotal: order.pricing?.total || 0
            },
            delivery: order.shipping,
            source: 'order_model'
          }));
          source = 'order_model';
        }
      } catch (orderError) {
        console.error('❌ Order model query failed:', orderError);
      }
    }
    
    console.log(`✅ Found ${orders.length} orders from ${source}`);
    
    res.json({
      success: true,
      orders,
      source,
      count: orders.length
    });

  } catch (error) {
    console.error('❌ Error fetching customer orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch orders',
      details: error.message
    });
  }
});

// ✅ GET ORDER DETAILS - COMBINE DATA FROM BOTH MODELS
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('📥 Fetching order details:', orderId);
    
    let orderData = null;
    let paymentData = null;
    let source = '';
    
    // Try to get from Payment model first
    try {
      paymentData = await Payment.findOne({ orderId })
        .select('-razorpaySignature -__v');
      
      if (paymentData) {
        orderData = {
          orderId: paymentData.orderId,
          orderNumber: paymentData.orderNumber || paymentData.orderId,
          orderDate: paymentData.orderDate || paymentData.createdAt,
          status: paymentData.status,
          paymentStatus: paymentData.paymentStatus,
          items: paymentData.items,
          total: paymentData.financials?.grandTotal / 100 || paymentData.amount / 100,
          customer: paymentData.customer,
          shippingAddress: paymentData.shippingAddress,
          financials: paymentData.financialsInRupees,
          delivery: paymentData.delivery,
          fulfillment: paymentData.fulfillment,
          paymentDetails: {
            paymentId: paymentData.razorpayPaymentId,
            method: paymentData.method,
            bank: paymentData.bank,
            paymentDate: paymentData.paymentDate
          },
          source: 'payment_model'
        };
        source = 'payment_model';
      }
    } catch (paymentError) {
      console.log('⚠️ Payment model query failed:', paymentError.message);
    }
    
    // If not found in Payment model, try Order model
    if (!orderData) {
      try {
        const orderDoc = await Order.findOne({ orderId });
        
        if (orderDoc) {
          orderData = {
            orderId: orderDoc.orderId,
            orderNumber: orderDoc.orderId,
            orderDate: orderDoc.createdAt,
            status: orderDoc.status,
            paymentStatus: orderDoc.paymentStatus,
            items: orderDoc.items,
            total: orderDoc.pricing?.total || 0,
            customer: orderDoc.customer,
            shippingAddress: orderDoc.shippingAddress,
            financials: {
              subtotal: orderDoc.pricing?.subtotal || 0,
              deliveryCharge: orderDoc.pricing?.deliveryCharge || 0,
              taxAmount: orderDoc.pricing?.taxAmount || 0,
              grandTotal: orderDoc.pricing?.total || 0
            },
            delivery: orderDoc.shipping,
            paymentDetails: {
              paymentId: orderDoc.razorpayPaymentId,
              method: orderDoc.paymentMethod,
              paymentDate: orderDoc.paidAt
            },
            timeline: orderDoc.timeline,
            source: 'order_model'
          };
          source = 'order_model';
        }
      } catch (orderError) {
        console.error('❌ Order model query failed:', orderError);
      }
    }
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    console.log(`✅ Order found in ${source}`);
    
    res.json({
      success: true,
      order: orderData,
      source
    });

  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// ✅ GET ALL ORDERS (Admin) - COMBINE BOTH MODELS
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

    // Try to get from Payment model first
    let orders = [];
    let total = 0;
    
    try {
      const paymentFilter = {};
      if (status) paymentFilter.status = status;
      if (paymentMethod) paymentFilter.method = paymentMethod;
      if (dateFrom || dateTo) {
        paymentFilter.createdAt = {};
        if (dateFrom) paymentFilter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) paymentFilter.createdAt.$lte = new Date(dateTo);
      }
      
      const skip = (page - 1) * limit;
      
      const payments = await Payment.find(paymentFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-razorpaySignature -__v');
      
      total = await Payment.countDocuments(paymentFilter);
      
      orders = payments.map(payment => ({
        orderId: payment.orderId,
        orderNumber: payment.orderNumber || payment.orderId,
        orderDate: payment.orderDate || payment.createdAt,
        customer: payment.customer,
        items: payment.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: payment.financials?.grandTotal / 100 || payment.amount / 100,
        status: payment.status,
        paymentStatus: payment.paymentStatus,
        paymentMethod: payment.method,
        source: 'payment_model'
      }));
      
    } catch (paymentError) {
      console.log('⚠️ Payment model query failed, falling back to Order model');
      
      // Fallback to Order model
      const orderFilter = {};
      if (status) orderFilter.status = status;
      if (paymentMethod) orderFilter.paymentMethod = paymentMethod;
      if (dateFrom || dateTo) {
        orderFilter.createdAt = {};
        if (dateFrom) orderFilter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) orderFilter.createdAt.$lte = new Date(dateTo);
      }
      
      const skip = (page - 1) * limit;
      
      const orderDocs = await Order.find(orderFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      total = await Order.countDocuments(orderFilter);
      
      orders = orderDocs.map(order => ({
        orderId: order.orderId,
        orderNumber: order.orderId,
        orderDate: order.createdAt,
        customer: order.customer,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.pricing?.total || 0,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        source: 'order_model'
      }));
    }

    res.json({
      success: true,
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ UPDATE ORDER STATUS - UPDATE BOTH MODELS
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { status, trackingNumber, estimatedDelivery, notes } = req.body;
    const { orderId } = req.params;
    
    const updates = {};
    let orderUpdated = false;
    let paymentUpdated = false;
    
    // Update Order model
    try {
      const order = await Order.findOne({ orderId });
      if (order) {
        order.status = status;
        order.addTimelineEvent(status, notes || `Status updated to ${status}`);
        
        if (trackingNumber) order.shipping.trackingNumber = trackingNumber;
        if (estimatedDelivery) order.shipping.estimatedDelivery = new Date(estimatedDelivery);
        if (status === 'shipped') order.shipping.shippedAt = new Date();
        if (status === 'delivered') order.shipping.deliveredAt = new Date();
        
        await order.save();
        orderUpdated = true;
        console.log(`✅ Order model updated: ${orderId}`);
      }
    } catch (orderError) {
      console.error('❌ Failed to update Order model:', orderError);
    }
    
    // Update Payment model
    try {
      const payment = await Payment.findOne({ orderId });
      if (payment) {
        payment.status = status;
        payment.fulfillment.status = status;
        
        if (trackingNumber) payment.fulfillment.trackingNumber = trackingNumber;
        if (estimatedDelivery) payment.delivery.estimatedDelivery = new Date(estimatedDelivery);
        if (status === 'shipped') {
          payment.fulfillment.shippedDate = new Date();
          payment.shipping.shippedAt = new Date();
        }
        if (status === 'delivered') {
          payment.fulfillment.deliveredDate = new Date();
          payment.delivery.actualDelivery = new Date();
        }
        
        if (notes) {
          payment.notes = payment.notes || {};
          payment.notes.internalNotes = notes;
        }
        
        await payment.save();
        paymentUpdated = true;
        console.log(`✅ Payment model updated: ${orderId}`);
      }
    } catch (paymentError) {
      console.error('❌ Failed to update Payment model:', paymentError);
    }
    
    if (!orderUpdated && !paymentUpdated) {
      return res.status(404).json({
        success: false,
        error: 'Order not found in any model'
      });
    }
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      updatedIn: {
        orderModel: orderUpdated,
        paymentModel: paymentUpdated
      }
    });

  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ SYNC ORDER BETWEEN MODELS (Admin tool)
router.post('/sync/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get from Order model
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found in Order model'
      });
    }
    
    // Check if exists in Payment model
    let payment = await Payment.findOne({ orderId });
    
    if (payment) {
      // Update existing payment
      payment.customer = order.customer;
      payment.shippingAddress = order.shippingAddress;
      payment.items = order.items;
      payment.status = order.status;
      payment.paymentStatus = order.paymentStatus;
      payment.amount = order.pricing?.total * 100 || 0;
      payment.financials = {
        subtotal: order.pricing?.subtotal * 100 || 0,
        deliveryCharge: order.pricing?.deliveryCharge * 100 || 0,
        taxAmount: order.pricing?.taxAmount * 100 || 0,
        grandTotal: order.pricing?.total * 100 || 0
      };
      
      await payment.save();
      
      res.json({
        success: true,
        message: 'Payment document updated from Order',
        action: 'updated'
      });
      
    } else {
      // Create new payment document
      const paymentData = {
        orderId: order.orderId,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        customer: order.customer,
        shippingAddress: order.shippingAddress,
        items: order.items,
        amount: order.pricing?.total * 100 || 0,
        currency: 'INR',
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentDate: order.paidAt,
        financials: {
          subtotal: order.pricing?.subtotal * 100 || 0,
          deliveryCharge: order.pricing?.deliveryCharge * 100 || 0,
          taxAmount: order.pricing?.taxAmount * 100 || 0,
          grandTotal: order.pricing?.total * 100 || 0
        },
        fulfillment: {
          status: order.status === 'delivered' ? 'delivered' : 'pending'
        },
        delivery: {
          method: order.shipping.method || 'Standard Delivery',
          estimatedDelivery: order.shipping.estimatedDelivery
        }
      };
      
      await Payment.create(paymentData);
      
      res.json({
        success: true,
        message: 'Payment document created from Order',
        action: 'created'
      });
    }
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
