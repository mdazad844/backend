const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ FIXED ORDER CREATION WITH GST CALCULATION
router.post('/create-order', async (req, res) => {
  try {
    const { 
      subtotal,      // Items total without GST
      deliveryCharge = 0, 
      currency = 'INR', 
      receipt 
    } = req.body;

    console.log('📊 Received order data:', req.body);

    // 1. Calculate GST (5% on subtotal + delivery)
    const taxableValue = Number(subtotal) + Number(deliveryCharge);
    const gstAmount = Math.round(taxableValue * 0.05); // 5% GST
    const totalAmount = taxableValue + gstAmount;
    const amountInPaise = Math.round(totalAmount * 100); // Convert to paise

    console.log('🧮 Amount Calculation:');
    console.log('Subtotal (Items): ₹', subtotal);
    console.log('Delivery Charge: ₹', deliveryCharge);
    console.log('Taxable Value: ₹', taxableValue);
    console.log('GST (5%): ₹', gstAmount);
    console.log('Total Amount: ₹', totalAmount);
    console.log('Amount in Paise:', amountInPaise);

    // 2. Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise, // This should include GST
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        // Store breakdown in notes for reference
        subtotal: subtotal.toString(),
        delivery_charge: deliveryCharge.toString(),
        gst_amount: gstAmount.toString(),
        gst_rate: '5%',
        total_before_tax: taxableValue.toString(),
        final_amount: totalAmount.toString()
      },
      payment_capture: 1
    });

    console.log('✅ Razorpay order created:', order.id);
    console.log('Razorpay order amount:', order.amount, 'paise');
    
    // 3. Send response with breakdown
    res.json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      // Send breakdown to frontend for display
      breakdown: {
        subtotal: Number(subtotal),
        deliveryCharge: Number(deliveryCharge),
        gstAmount: gstAmount,
        total: totalAmount,
        displayText: `Items: ₹${subtotal} + Delivery: ₹${deliveryCharge} + GST (5%): ₹${gstAmount} = ₹${totalAmount}`
      }
    });

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    
    // More detailed error logging
    if (error.error) {
      console.error('Razorpay API Error:', error.error);
    }
    
    res.status(500).json({
      success: false,
      error: error.error?.description || 'Order creation failed',
      details: error.message
    });
  }
});

// ✅ PAYMENT VERIFICATION (Updated with GST info)
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 Payment verification started');
    
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature 
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

    // 2. Get payment and order details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const order = await razorpay.orders.fetch(razorpay_order_id);
    
    console.log('📋 Order notes (GST info):', order.notes);

    if (payment.status === 'captured') {
      console.log('✅ Payment captured successfully');
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        // Include GST info from order notes
        gstInfo: order.notes || {}
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
      error: 'Payment verification failed'
    });
  }
});

// ✅ NEW: Calculate order total with GST
router.post('/calculate-total', (req, res) => {
  try {
    const { subtotal, deliveryCharge = 0 } = req.body;
    
    const taxableValue = Number(subtotal) + Number(deliveryCharge);
    const gstAmount = Math.round(taxableValue * 0.05);
    const totalAmount = taxableValue + gstAmount;
    
    res.json({
      success: true,
      breakdown: {
        subtotal: Number(subtotal),
        deliveryCharge: Number(deliveryCharge),
        taxableValue: taxableValue,
        gstAmount: gstAmount,
        gstRate: '5%',
        totalAmount: totalAmount,
        amountInPaise: totalAmount * 100
      },
      display: {
        summary: `Items: ₹${subtotal} + Delivery: ₹${deliveryCharge} + GST (5%): ₹${gstAmount}`,
        total: `₹${totalAmount}`
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Calculation failed'
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
