// backend/routes/payments.js - UPDATED
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/payment'); // Import Payment model

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ CREATE ORDER WITH COMPLETE DETAILS
router.post('/create-order', async (req, res) => {
  try {
    const { 
      subtotal,
      deliveryCharge = 0,
      currency = 'INR',
      receipt,
      orderData // New: Complete order data from frontend
    } = req.body;

    console.log('📦 Creating order with data:', { subtotal, deliveryCharge, receipt });

    // Calculate GST and total
    const taxableValue = Number(subtotal) + Number(deliveryCharge);
    const gstAmount = Math.round(taxableValue * 0.05);
    const totalAmount = taxableValue + gstAmount;
    const amountInPaise = Math.round(totalAmount * 100);

    console.log('🧮 Calculated amounts:', {
      taxableValue,
      gstAmount,
      totalAmount,
      amountInPaise
    });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        orderId: receipt,
        subtotal: subtotal.toString(),
        delivery_charge: deliveryCharge.toString(),
        gst_amount: gstAmount.toString(),
        total_amount: totalAmount.toString()
      },
      payment_capture: 1
    });

    console.log('✅ Razorpay order created:', order.id);

    // Save order data temporarily (or in database) for verification
    if (orderData) {
      // Store order data temporarily (you might want to save to database here)
      req.app.locals.pendingOrders = req.app.locals.pendingOrders || {};
      req.app.locals.pendingOrders[order.id] = {
        ...orderData,
        razorpayOrderId: order.id,
        financials: {
          subtotal: Number(subtotal),
          deliveryCharge: Number(deliveryCharge),
          taxAmount: gstAmount,
          grandTotal: totalAmount
        }
      };
    }

    res.json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      breakdown: {
        subtotal: Number(subtotal),
        deliveryCharge: Number(deliveryCharge),
        gstAmount: gstAmount,
        total: totalAmount
      }
    });

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.error?.description || 'Order creation failed'
    });
  }
});

// ✅ VERIFY PAYMENT AND SAVE COMPLETE ORDER
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 Payment verification started');
    
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      orderData // Complete order data from frontend
    } = req.body;

    // 1. Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.log('❌ Signature mismatch');
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    console.log('✅ Signature verified');

    // 2. Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status === 'captured') {
      console.log('✅ Payment captured successfully');
      
      // 3. Get order details from Razorpay
      const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
      
      // 4. Get pending order data (or use orderData from request)
      const pendingOrder = req.app.locals?.pendingOrders?.[razorpay_order_id] || orderData;
      
      if (!pendingOrder) {
        console.warn('⚠️ No order data found for:', razorpay_order_id);
      }
      
      // 5. Create complete order document
      const orderDoc = {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        orderId: razorpayOrder.receipt || `order_${Date.now()}`,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        bank: payment.bank,
        customer: {
          userId: pendingOrder?.userId,
          name: pendingOrder?.customer?.name || payment.notes?.customer_name || 'Customer',
          email: pendingOrder?.customer?.email || payment.email || 'customer@example.com',
          phone: pendingOrder?.customer?.phone || payment.contact || ''
        },
        shippingAddress: pendingOrder?.shippingAddress || {
          line1: 'Address not provided',
          city: 'City not provided',
          state: 'State not provided',
          pincode: '000000',
          country: 'India'
        },
        items: pendingOrder?.items || [],
        financials: pendingOrder?.financials || {
          subtotal: parseInt(razorpayOrder.notes?.subtotal) || 0,
          deliveryCharge: parseInt(razorpayOrder.notes?.delivery_charge) || 0,
          taxAmount: parseInt(razorpayOrder.notes?.gst_amount) || 0,
          grandTotal: parseInt(razorpayOrder.notes?.total_amount) || 0
        },
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentDate: new Date(),
        fulfillment: {
          status: 'pending',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        },
        delivery: {
          method: 'Standard Delivery',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        },
        notes: {
          customerNotes: pendingOrder?.notes || '',
          internalNotes: `Payment method: ${payment.method}`
        }
      };
      
      // 6. Save to database
      const savedPayment = await Payment.create(orderDoc);
      
      console.log('💾 Order saved to database:', savedPayment.orderId);
      
      // 7. Clean up pending orders
      if (req.app.locals?.pendingOrders?.[razorpay_order_id]) {
        delete req.app.locals.pendingOrders[razorpay_order_id];
      }
      
      // 8. Send success response with order details
      res.json({
        success: true,
        message: 'Payment verified and order saved successfully',
        orderId: savedPayment.orderId,
        orderNumber: savedPayment.orderNumber,
        paymentId: razorpay_payment_id,
        orderDetails: {
          items: savedPayment.items,
          financials: savedPayment.financials,
          customer: savedPayment.customer,
          shippingAddress: savedPayment.shippingAddress,
          status: savedPayment.status,
          estimatedDelivery: savedPayment.delivery.estimatedDelivery
        }
      });
      
    } else {
      console.log('❌ Payment not captured:', payment.status);
      res.status(400).json({
        success: false,
        error: `Payment failed with status: ${payment.status}`
      });
    }

  } catch (error) {
    console.error('💥 Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      details: error.message
    });
  }
});

// ✅ GET CUSTOMER ORDERS
router.get('/customer-orders/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const orders = await Payment.find({ 'customer.email': email })
      .sort({ createdAt: -1 })
      .select('-razorpaySignature -__v');
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        financials: order.financialsInRupees,
        customer: order.customer,
        shippingAddress: order.shippingAddress,
        delivery: order.delivery,
        fulfillment: order.fulfillment
      }))
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// ✅ GET ORDER DETAILS
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Payment.findOne({ orderId })
      .select('-razorpaySignature -__v');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        financials: order.financialsInRupees,
        customer: order.customer,
        shippingAddress: order.shippingAddress,
        delivery: order.delivery,
        fulfillment: order.fulfillment,
        paymentDetails: {
          paymentId: order.razorpayPaymentId,
          paymentMethod: order.method,
          paymentDate: order.paymentDate
        },
        notes: order.notes
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// ✅ GET ALL ORDERS (For admin)
router.get('/admin/orders', async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const orders = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-razorpaySignature -__v');
    
    const totalOrders = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customer: order.customer,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        financials: order.financialsInRupees,
        status: order.status,
        paymentStatus: order.paymentStatus,
        delivery: order.delivery
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalOrders,
        pages: Math.ceil(totalOrders / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch admin orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// ✅ UPDATE ORDER STATUS (For admin)
router.patch('/admin/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, carrier, notes } = req.body;
    
    const updateData = {};
    
    if (status) {
      updateData.status = status;
      updateData['fulfillment.status'] = status;
      
      if (status === 'shipped') {
        updateData['fulfillment.shippedDate'] = new Date();
        if (trackingNumber) updateData['fulfillment.trackingNumber'] = trackingNumber;
        if (carrier) updateData['fulfillment.carrier'] = carrier;
      } else if (status === 'delivered') {
        updateData['fulfillment.deliveredDate'] = new Date();
        updateData['delivery.actualDelivery'] = new Date();
      }
    }
    
    if (notes) {
      updateData['notes.internalNotes'] = notes;
    }
    
    const updatedOrder = await Payment.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    ).select('-razorpaySignature -__v');
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });
    
  } catch (error) {
    console.error('❌ Failed to update order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Health check
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payments API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
