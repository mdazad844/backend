const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ CREATE ORDER WITH CALCULATIONS
router.post('/create-order', async (req, res) => {
  try {
    console.log('🎯 Creating order with backend calculation...');
    
    const {
      items,
      subtotal: frontendSubtotal,
      deliveryCharge,
      customer,
      orderId
    } = req.body;

    // 1. VALIDATE INPUT
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing items'
      });
    }

    // 2. CALCULATE SUBTOTAL (recalculate for security)
    const calculatedSubtotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // 3. CALCULATE TAX (5% on product cost + delivery)
    const taxableAmount = calculatedSubtotal + (deliveryCharge || 0);
    const taxAmount = Math.round(taxableAmount * 0.05);
    
    // 4. CALCULATE GRAND TOTAL
    const total = calculatedSubtotal + (deliveryCharge || 0) + taxAmount;
    
    // 5. CONVERT TO PAISE for Razorpay
    const amountInPaise = Math.round(total * 100);

    console.log('💰 Backend Calculation Results:');
    console.log(`   - Subtotal: ₹${calculatedSubtotal}`);
    console.log(`   - Delivery: ₹${deliveryCharge || 0}`);
    console.log(`   - Taxable Amount: ₹${taxableAmount}`);
    console.log(`   - Tax (5%): ₹${taxAmount}`);
    console.log(`   - Grand Total: ₹${total}`);
    console.log(`   - Razorpay Amount: ${amountInPaise} paise`);

    // 6. CREATE RAZORPAY ORDER
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderId || `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: {
        subtotal: calculatedSubtotal,
        tax: taxAmount,
        delivery: deliveryCharge || 0,
        customer_email: customer?.email || 'unknown'
      }
    });

    console.log(`✅ Razorpay order created: ${razorpayOrder.id}`);

    // 7. RETURN SUCCESS RESPONSE WITH CALCULATIONS
    res.json({
      success: true,
      orderId: orderId || razorpayOrder.receipt,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // Amount in paise
      currency: razorpayOrder.currency,
      
      // Return calculated values for frontend display
      subtotal: calculatedSubtotal,
      taxAmount: taxAmount,
      deliveryCharge: deliveryCharge || 0,
      total: total,
      
      // Breakdown for transparency
      breakdown: {
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          itemTotal: item.price * item.quantity
        })),
        taxCalculation: {
          taxableAmount: taxableAmount,
          taxRate: '5%',
          taxAmount: taxAmount
        }
      }
    });

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.error?.description || error.message || 'Order creation failed'
    });
  }
});

// ✅ VERIFY PAYMENT (Updated to include order details)
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 Payment verification started');
    
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      orderDetails 
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
      
      // ✅ Optional: Save order to database here
      // await saveOrderToDatabase(orderDetails, payment);
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: payment.amount / 100, // Convert to rupees
        orderDetails: orderDetails
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

// ✅ OPTIONAL: Add a calculation-only endpoint
router.post('/calculate-order', async (req, res) => {
  try {
    const { items, deliveryCharge } = req.body;

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const taxableAmount = subtotal + (deliveryCharge || 0);
    const taxAmount = Math.round(taxableAmount * 0.05);
    const total = subtotal + (deliveryCharge || 0) + taxAmount;

    res.json({
      success: true,
      calculations: {
        subtotal: subtotal,
        deliveryCharge: deliveryCharge || 0,
        taxableAmount: taxableAmount,
        taxAmount: taxAmount,
        taxRate: '5%',
        total: total
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
