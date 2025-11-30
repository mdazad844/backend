// Payment Utility Functions
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');

class PaymentHelper {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create Razorpay order
  async createRazorpayOrder(orderData) {
    try {
      const { amount, currency, receipt, notes } = orderData;

      const options = {
        amount: Math.round(amount), // in paise
        currency: currency || 'INR',
        receipt: receipt,
        notes: notes,
       
      };

      const order = await this.razorpay.orders.create(options);
      
      console.log(`✅ Razorpay order created: ${order.id}`);
      
      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      };

    } catch (error) {
      console.error('❌ Razorpay order creation failed:', error);
      
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
  calculateGST(items) {
    const gstSlabs = {
      low: { threshold: 2500, rate: 0.05 },  // 5% GST for ≤ ₹2,500
      high: { threshold: 2501, rate: 0.18 }  // 18% GST for > ₹2,500
    };

    let totalTax = 0;
    let tax5 = 0;
    let tax18 = 0;

    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      const taxRate = item.price <= gstSlabs.low.threshold ? 
        gstSlabs.low.rate : gstSlabs.high.rate;
      
      const itemTax = itemTotal * taxRate;
      totalTax += itemTax;

      if (taxRate === gstSlabs.low.rate) {
        tax5 += itemTax;
      } else {
        tax18 += itemTax;
      }
    });

    return {
      totalTax: Math.round(totalTax),
      tax5: Math.round(tax5),
      tax18: Math.round(tax18),
      hasMixedRates: tax5 > 0 && tax18 > 0
    };
  }

  // Generate order summary for payment
  generateOrderSummary(order) {
    const subtotal = order.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );

    const taxDetails = this.calculateGST(order.items);
    const total = subtotal + taxDetails.totalTax + (order.deliveryCharge || 0);

    return {
      subtotal: Math.round(subtotal),
      taxAmount: taxDetails.totalTax,
      taxDetails,
      deliveryCharge: order.deliveryCharge || 0,
      total: Math.round(total),
      currency: 'INR'
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
  async getPaymentAnalytics(timeframe = '30d') {
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
