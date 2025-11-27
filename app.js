const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
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
    hasRazorpayKey: !!process.env.RAZORPAY_KEY_ID
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
  app.use('/api/payments', require('./payments'));
  app.use('/api/orders', require('./orders'));
  app.use('/api/analytics', require('./analytics'));
  app.use('/api/webhooks', require('./webhooks'));
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
    port: process.env.PORT
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
📊 Health: http://0.0.0.0:${PORT}/
💳 Payments: http://0.0.0.0:${PORT}/api/payments
    `);
  });
}

module.exports = app; // For testing


