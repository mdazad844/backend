// backend/routes/payments.js - UPDATED verify-payment endpoint
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
      
      // 4. Get pending order data
      const pendingOrder = req.app.locals?.pendingOrders?.[razorpay_order_id] || orderData;
      
      if (!pendingOrder) {
        console.warn('⚠️ No order data found for:', razorpay_order_id);
      }
      
      // 5. Generate order ID
      const orderId = razorpayOrder.receipt || `MB${Date.now()}`;
      
      // Calculate financials
      const subtotal = pendingOrder?.subtotal || parseInt(razorpayOrder.notes?.subtotal) || 0;
      const deliveryCharge = pendingOrder?.deliveryCharge || parseInt(razorpayOrder.notes?.delivery_charge) || 0;
      const taxableValue = subtotal + deliveryCharge;
      const taxAmount = Math.round(taxableValue * 0.05); // 5% GST
      const grandTotal = subtotal + deliveryCharge + taxAmount;
      
      // 6. SAVE TO PAYMENT MODEL (with complete data)
      const paymentDocData = {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpaySignature: razorpay_signature,
        orderId: orderId,
        amount: payment.amount, // in paise
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
        financials: {
          subtotal: subtotal * 100, // Convert to paise
          deliveryCharge: deliveryCharge * 100,
          taxAmount: taxAmount * 100,
          grandTotal: grandTotal * 100
        },
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentDate: new Date(),
        fulfillment: {
          status: 'pending',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        },
        delivery: {
          method: 'Standard Delivery',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }
      };
      
      const savedPayment = await Payment.create(paymentDocData);
      console.log('✅ Payment document saved:', savedPayment.orderId);
      
      // 7. SAVE TO ORDER MODEL (for backward compatibility)
      const orderDocData = {
        orderId: orderId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        customer: {
          userId: pendingOrder?.userId,
          name: pendingOrder?.customer?.name || payment.notes?.customer_name || 'Customer',
          email: pendingOrder?.customer?.email || payment.email || 'customer@example.com',
          phone: pendingOrder?.customer?.phone || payment.contact || ''
        },
        shippingAddress: pendingOrder?.shippingAddress || {
          line1: 'Address not provided',
          line2: '',
          city: 'City not provided',
          state: 'State not provided',
          pincode: '000000',
          country: 'India'
        },
        items: pendingOrder?.items?.map(item => ({
          productId: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size || '',
          color: item.color || '',
          image: item.image || item.img || ''
        })) || [],
        pricing: {
          subtotal: subtotal,
          taxAmount: taxAmount,
          taxDetails: {
            gst5: taxAmount,
            gst18: 0
          },
          deliveryCharge: deliveryCharge,
          total: grandTotal
        },
        shipping: {
          method: 'standard',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        },
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        paidAt: new Date(),
        timeline: [
          {
            status: 'created',
            description: 'Order created successfully',
            timestamp: new Date()
          },
          {
            status: 'payment_received',
            description: 'Payment received via Razorpay',
            timestamp: new Date()
          }
        ],
        notes: {
          customer: pendingOrder?.notes || '',
          admin: `Payment method: ${payment.method}`
        }
      };
      
      const savedOrder = await Order.create(orderDocData);
      console.log('✅ Order document saved:', savedOrder.orderId);
      
      // 8. Clean up pending orders
      if (req.app.locals?.pendingOrders?.[razorpay_order_id]) {
        delete req.app.locals.pendingOrders[razorpay_order_id];
      }
      
      // 9. Prepare response data
      const responseData = {
        success: true,
        message: 'Payment verified and order saved successfully',
        orderId: orderId,
        orderNumber: savedPayment.orderNumber || orderId,
        paymentId: razorpay_payment_id,
        orderDetails: {
          items: savedPayment.items,
          financials: {
            subtotal: subtotal,
            deliveryCharge: deliveryCharge,
            taxAmount: taxAmount,
            grandTotal: grandTotal
          },
          customer: savedPayment.customer,
          shippingAddress: savedPayment.shippingAddress,
          status: 'confirmed',
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }
      };
      
      console.log('📤 Sending response:', responseData);
      res.json(responseData);
      
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
