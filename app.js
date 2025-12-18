const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS Configuration for your frontend
const corsOptions = {
    origin: [
        'https://blinkberrys.com',
        'https://www.blinkberrys.com',
        'http://localhost:3000', // for local development
        'http://localhost:5173'  // for Vite development
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint for health checks
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MyBrand Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check environment variables (remove in production if needed)
app.get('/debug-env', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    hasMongoUri: !!process.env.MONGODB_URI,
    hasRazorpayKey: !!process.env.RAZORPAY_KEY_ID,
    frontendUrl: 'https://blinkberrys.com'
  });
});

// Database connection with better error handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message);
  console.log('💡 Please check your MONGODB_URI environment variable');
});

// Import routes only if they exist to prevent crashes
try {
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/orders', require('./routes/orders'));
 app.use('/api/ordersdash', require('./routes/ordersdash')); 
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/webhooks', require('./routes/webhooks'));
  app.use('/api/shipping', require('./routes/shipping'));
    app.use('/api/emails', require('./routes/emails'));
     app.use('/api/contact', require('./routes/contact')); 
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/admin', require('./routes/adminRoutes'));
  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.error('❌ Route loading error:', error);
}

// Enhanced health check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT,
    cors: {
      allowedOrigins: corsOptions.origin,
      frontend: 'https://blinkberrys.com'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Error:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

const PORT = process.env.PORT || 3000;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 MyBrand Backend Server Started!
📍 Port: ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
🎯 Frontend: https://blinkberrys.com
📊 Health: http://0.0.0.0:${PORT}/
💳 Payments: http://0.0.0.0:${PORT}/api/payments
🔧 CORS: Enabled for frontend domains
    `);
  });
}



// Replace your /test-payment route with this SIMPLE version
app.get('/test-payment', async (req, res) => {
  console.log('🧪 SIMPLE TEST STARTED');
  
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const paymentId = 'pay_RlzCHJpXLntppF';
    const payment = await razorpay.payments.fetch(paymentId);
    
    console.log('📊 Payment Status:', {
      status: payment.status,
      captured: payment.captured,
      amount: payment.amount,
      order_id: payment.order_id
    });

    let captureResult = null;
    if (payment.status === 'authorized' && !payment.captured) {
      console.log('💸 Attempting capture...');
      captureResult = await razorpay.payments.capture(paymentId, payment.amount);
      console.log('✅ Capture result:', captureResult.id);
    }

    res.json({
      status: payment.status,
      captured: payment.captured,
      amount: payment.amount,
      order_id: payment.order_id,
      capture_attempt: captureResult ? 'success' : 'not needed'
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
    res.json({ error: error.message });
  }
});




module.exports = app; // For testing










