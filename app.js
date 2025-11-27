const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Debug logging
console.log('=== APP STARTING ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CRITICAL: Root route for Railway health check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'MyBrand Backend API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/payments', require('./routes/payments'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/webhooks', require('./routes/webhooks'));

// Health check with database status
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development'
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ✅ CRITICAL: Start server even if MongoDB fails
const startServer = async () => {
  try {
    // Try to connect to MongoDB, but don't block server startup
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('⚠️  MONGODB_URI not set, running without database');
    }

    // ✅ CRITICAL: Bind to 0.0.0.0 for Railway
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🚀 MyBrand Backend Server Started!
📍 Port: ${PORT}
📍 Host: 0.0.0.0
🌐 Health: http://0.0.0.0:${PORT}/
📊 API Health: http://0.0.0.0:${PORT}/api/health
💳 Payments: http://0.0.0.0:${PORT}/api/payments
📦 Orders: http://0.0.0.0:${PORT}/api/orders
✅ Server is ready for health checks!
      `);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('🔄 Starting server without database connection...');
    
    // Start server even if DB fails
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server started on port ${PORT} (without MongoDB)`);
    });
  }
};

// Start the server
startServer();
