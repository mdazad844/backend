// Payment Utility Functions
const Razorpay = require('razorpay');
//const Payment = require('../models/Payment');

class PaymentHelper {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create Razorpay order
  // In backend/utils/paymentHelper.js - Updated createRazorpayOrder function

// In backend/utils/paymentHelper.js

async createRazorpayOrder(orderData) {
  try {
    const { items, deliveryCharge = 0, receipt, notes } = orderData;

    // Calculate amounts with rounding
    const subtotal = items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0);
    
    const taxableValue = subtotal + deliveryCharge;
    const gstAmount = Math.round(taxableValue * 0.05);
    const total = subtotal + deliveryCharge + gstAmount;
    
    const amountInPaise = Math.round(total * 100);

    // Debug logging
    console.log('🔍 RAZORPAY ORDER CALCULATION:');
    console.log('Subtotal:', subtotal);
    console.log('Delivery Charge:', deliveryCharge);
    console.log('Taxable Value:', taxableValue);
    console.log('GST (5%):', gstAmount);
    console.log('Total (₹):', total);
    console.log('Total in paise:', amountInPaise);
    console.log('Rounded paise:', Math.round(total * 100));

    const options = {
      amount: amountInPaise, // Must be integer
      currency: 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        ...notes,
        subtotal,
        deliveryCharge,
        gstAmount,
        itemsCount: items.length
      },
      payment_capture: 1
    };

    console.log('📤 Sending to Razorpay:', options);

    const order = await this.razorpay.orders.create(options);
    
    console.log(`✅ Razorpay order created: ${order.id}`);
    console.log(`Razorpay response amount: ${order.amount} paise`);
    
    // Verify amount matches
    if (order.amount !== amountInPaise) {
      console.warn(`⚠️ Amount mismatch! Sent: ${amountInPaise}, Received: ${order.amount}`);
    }

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      breakdown: {
        subtotal,
        deliveryCharge,
        gstAmount,
        total: total,
        totalInPaise: amountInPaise
      }
    };

  } catch (error) {
    console.error('❌ Razorpay order creation failed:', error);
    
    // Detailed error logging
    if (error.error) {
      console.error('Razorpay error details:', error.error);
    }
    
    return {
      success: false,
      error: error.error?.description || error.message
    };
  }
}

  

  // Verify payment signature
  verifyPaymentSignature(paymentData) {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;
    
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    
    if (!isValid) {
      console.error('❌ Payment signature verification failed');
    }

    return isValid;
  }

  // Get payment details from Razorpay
  async getPaymentDetails(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('❌ Failed to fetch payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process refund
  async processRefund(paymentId, amount, reason = 'customer_request') {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100), // convert to paise
        notes: { reason }
      });

      console.log(`✅ Refund processed: ${refund.id}`);
      
      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100 // convert to rupees
      };

    } catch (error) {
      console.error('❌ Refund failed:', error);
      
      return {
        success: false,
        error: error.error?.description || error.message
      };
    }
  }

  // Check payment status
  async checkPaymentStatus(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      return {
        success: true,
        status: payment.status,
        amount: payment.amount / 100,
        method: payment.method,
        captured: payment.captured
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate GST for items
  // Updated calculateGST function in backend/utils/paymentHelper.js

// Updated calculateGST function with only 5% GST
calculateGST(items, deliveryCharge = 0) {
  // Only 5% GST rate
  const GST_RATE = 0.05; // 5%
  
  // Calculate total value of items
  const itemsTotal = items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );
  
  // Total taxable value (items + delivery charge)
  const taxableValue = itemsTotal + deliveryCharge;
  
  // Calculate 5% GST
  const gstAmount = taxableValue * GST_RATE;

  return {
    totalTax: Math.round(gstAmount),
    taxAmount: Math.round(gstAmount),
    gstRate: GST_RATE,
    taxableValue: Math.round(taxableValue),
    itemsTotal: Math.round(itemsTotal),
    deliveryCharge: Math.round(deliveryCharge),
    gstPercentage: "5%"
  };
}

// Updated generateOrderSummary function
generateOrderSummary(order) {
  const subtotal = order.items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  const deliveryCharge = order.deliveryCharge || 0;
  
  // Calculate 5% GST on (subtotal + delivery charge)
  const taxDetails = this.calculateGST(order.items, deliveryCharge);
  
  // Total = Subtotal + Delivery + 5% GST
  const total = subtotal + deliveryCharge + taxDetails.totalTax;

  return {
    subtotal: Math.round(subtotal),
    taxAmount: taxDetails.totalTax,
    taxDetails,
    deliveryCharge: Math.round(deliveryCharge),
    total: Math.round(total),
    currency: 'INR',
    breakdown: {
      items: subtotal,
      delivery: deliveryCharge,
      taxableValue: subtotal + deliveryCharge,
      gst5: taxDetails.totalTax,
      total: total
    },
    summaryText: `Items: ₹${Math.round(subtotal)} + Delivery: ₹${Math.round(deliveryCharge)} + GST (5%): ₹${taxDetails.totalTax} = Total: ₹${Math.round(total)}`
  };
}

// You can also add a helper function for invoice generation
generateInvoice(order, payment) {
  const summary = this.generateOrderSummary(order);
  
  return {
    invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toLocaleDateString('en-IN'),
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    })),
    taxDetails: {
      taxableValue: summary.taxDetails.taxableValue,
      gstRate: "5%",
      gstAmount: summary.taxAmount,
      cgst: Math.round(summary.taxAmount / 2), // Assuming 2.5% CGST and 2.5% SGST
      sgst: Math.round(summary.taxAmount / 2),
      igst: 0 // 0 for intra-state
    },
    paymentDetails: {
      razorpayOrderId: payment?.razorpayOrderId,
      razorpayPaymentId: payment?.razorpayPaymentId,
      paymentMethod: payment?.method,
      paymentStatus: payment?.status
    },
    total: summary.total,
    summary: summary.breakdown
  };
}

  // Validate payment data
  validatePaymentData(paymentData) {
    const errors = [];

    if (!paymentData.razorpay_payment_id) {
      errors.push('Payment ID is required');
    }

    if (!paymentData.razorpay_order_id) {
      errors.push('Order ID is required');
    }

    if (!paymentData.razorpay_signature) {
      errors.push('Payment signature is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get payment analytics
/*  async getPaymentAnalytics(timeframe = '30d') {
    const dateRange = this.getDateRange(timeframe);

    const paymentStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const methodStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'captured'
        }
      },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return {
      paymentStats,
      methodStats,
      timeframe
    };
  }
*/
  // Helper function for date ranges
  getDateRange(timeframe) {
    const end = new Date();
    const start = new Date();
    
    switch (timeframe) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
      case '1y': start.setFullYear(end.getFullYear() - 1); break;
      default: start.setDate(end.getDate() - 30);
    }
    
    return { start, end };
  }
}








module.exports = PaymentHelper;








