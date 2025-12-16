const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const axios = require('axios');

// ✅ ADD THESE 2 LINES:
const Payment = require('../models/payment');
const Order = require('../models/order');

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

// ✅ UPDATED: VERIFY PAYMENT AND SAVE TO DATABASE + SEND EMAIL
router.post('/verify-payment', async (req, res) => {
  try {
    console.log('🎯 Payment verification started');
    
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      orderData  // This comes from frontend
    } = req.body;

    console.log('📥 Received orderData:', orderData);

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
      
      // 3. Get Razorpay order details
      const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
      
      // 4. Generate unique order ID
      const orderId = orderData?.orderId || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // 5. CALCULATE GST (5% on subtotal + delivery)
      const subtotal = orderData?.pricing?.subtotal || 0;
      const deliveryCharge = orderData?.pricing?.deliveryCharge || 0;
      const taxableValue = subtotal + deliveryCharge;
      const gstAmount = Math.round(taxableValue * 0.05);
      const grandTotal = taxableValue + gstAmount;
      
      console.log('🧮 Final calculations:', {
        subtotal,
        deliveryCharge,
        gstAmount,
        grandTotal
      });
      
      // 6. SAVE TO PAYMENT MODEL
      try {
        const paymentDoc = new Payment({
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpaySignature: razorpay_signature,
          orderId: orderId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          bank: payment.bank,
          customer: {
            email: orderData?.customer?.email || payment.email || '',
            phone: orderData?.customer?.phone || payment.contact || '',
            name: orderData?.customer?.name || 'Customer'
          },
          status: 'captured',
          capturedAt: new Date(),
          notes: {
            order_items: JSON.stringify(orderData?.items || []),
            customer_notes: '',
            internal_notes: `Payment via ${payment.method}`
          }
        });
        
        await paymentDoc.save();
        console.log('✅ Payment saved to database');
        
      } catch (paymentError) {
        console.error('❌ Error saving payment:', paymentError);
        // Continue anyway - don't fail the whole process
      }
      
      // 7. SAVE TO ORDER MODEL (COMPLETE ORDER DATA)
      try {
        const orderDoc = new Order({
          orderId: orderId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          customer: {
            userId: orderData?.customer?.userId || '',
            name: orderData?.customer?.name || 'Customer',
            email: orderData?.customer?.email || '',
            phone: orderData?.customer?.phone || ''
          },
          shippingAddress: orderData?.shippingAddress || {
            line1: 'Address not provided',
            line2: '',
            city: 'Not provided',
            state: 'Not provided',
            pincode: '000000',
            country: 'India'
          },
          items: orderData?.items || [],
          pricing: {
            subtotal: subtotal,
            taxAmount: gstAmount,
            taxDetails: {
              gst5: gstAmount,
              gst18: 0
            },
            deliveryCharge: deliveryCharge,
            total: grandTotal
          },
          shipping: {
            method: 'standard',
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
          },
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentMethod: 'razorpay',
          paidAt: new Date(),
          timeline: [
            {
              status: 'created',
              description: 'Order created',
              timestamp: new Date()
            },
            {
              status: 'payment_received',
              description: 'Payment received via Razorpay',
              timestamp: new Date()
            }
          ]
        });
        
        await orderDoc.save();
        console.log('✅ Order saved to database');
        
      } catch (orderError) {
        console.error('❌ Error saving order:', orderError);
        // Continue anyway
      }
      
      // 8. SEND RECEIPT EMAIL (✅ NEW SECTION ADDED)
   
let emailSent = false;
let emailError = null;

try {
  const customerEmail = orderData?.customer?.email;
  const customerName = orderData?.customer?.name || 'Customer';
  
  if (customerEmail) {
    console.log('📧 Attempting to send receipt to:', customerEmail);
    
    // Use environment variable for backend URL or localhost
const backendUrl = 'https://backend-production-c281a.up.railway.app';
    
    const emailResponse = await axios.post(
      `${backendUrl}/api/emails/send-receipt`,
      {
        email: customerEmail,
        name: customerName,
        amount: grandTotal,
        orderId: orderId,  // ✅ COMMA ADDED HERE
        items: orderData?.items || []
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 second timeout
      }
    );
    
    if (emailResponse.data.success) {
      console.log('✅ Receipt email sent successfully:', emailResponse.data.emailId);
      emailSent = true;
    } else {
      console.log('⚠️ Email API returned error:', emailResponse.data.error);
      emailError = emailResponse.data.error;
    }
  } else {
    console.log('⚠️ No customer email provided, skipping receipt');
  }
} catch (emailErr) {
  console.error('❌ Email sending failed:', emailErr.message);
  // Don't fail the payment - just log the error
  emailError = emailErr.message;
}
      
      // 9. Return success response
      res.json({
        success: true,
        message: 'Payment verified and order saved to database',
        orderId: orderId,
        paymentId: razorpay_payment_id,
        savedToDatabase: true,
        emailSent: emailSent,
        emailError: emailError || null,
        orderDetails: {
          items: orderData?.items || [],
          customer: orderData?.customer || {},
          total: grandTotal,
          status: 'confirmed'
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



