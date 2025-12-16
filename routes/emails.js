const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Email templates
const templates = {
  paymentReceipt: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f7f9fc;
        }
        .container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 25px;
          color: #444;
        }
        .order-card {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .order-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }
        .order-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .label {
          font-weight: 600;
          color: #555;
        }
        .value {
          color: #222;
          font-weight: 500;
        }
        
        /* PRODUCT TABLE STYLES */
        .products-section {
          margin: 30px 0;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .products-header {
          background: #f8f9fa;
          padding: 15px 25px;
          border-bottom: 2px solid #667eea;
          font-weight: 600;
          color: #444;
          font-size: 18px;
        }
        .products-table {
          width: 100%;
          border-collapse: collapse;
        }
        .products-table th {
          background: #f9f9f9;
          padding: 15px;
          text-align: left;
          font-weight: 600;
          color: #555;
          border-bottom: 1px solid #eee;
        }
        .products-table td {
          padding: 15px;
          border-bottom: 1px solid #f5f5f5;
        }
        .product-row:hover {
          background: #f9f9f9;
        }
        .product-name {
          font-weight: 500;
          color: #333;
        }
        .product-price {
          color: #666;
        }
        .product-quantity {
          text-align: center;
        }
        .product-total {
          text-align: right;
          font-weight: 600;
          color: #2ecc71;
        }
        
        .amount {
          font-size: 24px;
          font-weight: 700;
          color: #2ecc71;
          text-align: center;
          margin: 20px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 10px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          text-align: center;
          margin: 25px auto;
          border: none;
          cursor: pointer;
          font-size: 16px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid #eee;
          color: #666;
          font-size: 14px;
        }
        .footer p {
          margin: 8px 0;
        }
        .highlight {
          background-color: #fff9e6;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #ffc107;
          margin: 20px 0;
        }
        @media (max-width: 600px) {
          body {
            padding: 10px;
          }
          .header, .content {
            padding: 25px 20px;
          }
          .products-table th,
          .products-table td {
            padding: 10px 8px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Confirmed! 🎉</h1>
          <p>Thank you for your purchase</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${data.name}</strong>,
          </div>
          
          <p>Your payment has been successfully processed. Here's your receipt:</p>
          
          <div class="order-card">
            <div class="order-row">
              <span class="label">Order ID:</span>
              <span class="value">${data.orderId}</span>
            </div>
            <div class="order-row">
              <span class="label">Date:</span>
              <span class="value">${new Date().toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div class="order-row">
              <span class="label">Time:</span>
              <span class="value">${new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div class="order-row">
              <span class="label">Payment Method:</span>
              <span class="value">Razorpay</span>
            </div>
          </div>
          
          <!-- PRODUCTS SECTION - ADDED -->
          ${data.items && data.items.length > 0 ? `
          <div class="products-section">
            <div class="products-header">📦 Purchased Items</div>
            <table class="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th class="product-quantity">Qty</th>
                  <th class="product-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(item => `
                  <tr class="product-row">
                    <td class="product-name">${item.name || 'Product'}</td>
                    <td class="product-price">₹${item.price || 0}</td>
                    <td class="product-quantity">${item.quantity || 1}</td>
                    <td class="product-total">₹${(item.price || 0) * (item.quantity || 1)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div class="amount">
            Total Amount: ₹${data.amount}
          </div>
          
          <div class="highlight">
            <p><strong>Note:</strong> You can now access your purchase immediately. If you face any issues, contact our support team.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://blinkberrys.com'}/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>
          
          <div class="footer">
            <p>Need help? Contact us at <a href="mailto:support@blinkberrys.com">support@blinkberrys.com</a></p>
            <p>© ${new Date().getFullYear()} Blinkberrys. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  welcomeEmail: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 40px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #4facfe; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .features { margin: 25px 0; }
        .feature-item { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #4facfe; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Blinkberrys! 👋</h1>
          <p>We're thrilled to have you on board</p>
        </div>
        <div class="content">
          <p>Hello <strong>${data.name}</strong>,</p>
          <p>Thank you for joining Blinkberrys! Your account has been successfully created.</p>
          
          <div class="features">
            <h3>Get Started:</h3>
            <div class="feature-item">📝 Complete your profile</div>
            <div class="feature-item">🚀 Explore our features</div>
            <div class="feature-item">💳 Upgrade for premium access</div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://blinkberrys.com'}/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>
          
          <p>If you have any questions, we're here to help!</p>
          <p>Best regards,<br>The Blinkberrys Team</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordReset: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b6b; color: white; padding: 30px; text-align: center; }
        .button { background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Password Reset Request</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p>Hello ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${data.resetLink}" class="button">Reset Password</a>
        </div>
        
        <div class="warning">
          <p><strong>Note:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
        
        <p>Thanks,<br>Blinkberrys Security Team</p>
      </div>
    </body>
    </html>
  `
};

// Send email endpoint (generic)
router.post('/send', async (req, res) => {
  try {
    const { to, subject, template, data } = req.body;
    
    if (!to || !subject || !template || !data) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, template, data' 
      });
    }
    
    if (!templates[template]) {
      return res.status(400).json({ 
        error: `Invalid template. Available: ${Object.keys(templates).join(', ')}` 
      });
    }
    
    const html = templates[template](data);
    
    const response = await resend.emails.send({
      from: 'support@blinkberrys.com', // Your verified domain
      to: to,
      subject: subject,
      html: html,
      reply_to: 'support@blinkberrys.com',
    });
    
    console.log('✅ Email sent:', response.data?.id);
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: response.data?.id 
    });
    
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
});

// Updated endpoint that accepts purchased items
router.post('/send-receipt', async (req, res) => {
  try {
    const { email, name, amount, orderId, items } = req.body;
    
    if (!email || !name || !amount || !orderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const response = await resend.emails.send({
      from: 'support@blinkberrys.com',
      to: email,
      subject: `Payment Receipt - Order #${orderId}`,
      html: templates.paymentReceipt({ 
        name, 
        amount, 
        orderId, 
        items: items || [] 
      }),
      reply_to: 'support@blinkberrys.com',
    });
    
    res.json({ 
      success: true, 
      message: 'Receipt sent successfully',
      emailId: response.data?.id 
    });
    
  } catch (error) {
    console.error('Receipt email error:', error);
    res.status(500).json({ 
      error: 'Failed to send receipt',
      details: error.message 
    });
  }
});

router.post('/send-welcome', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    const response = await resend.emails.send({
      from: 'support@blinkberrys.com',
      to: email,
      subject: 'Welcome to Blinkberrys!',
      html: templates.welcomeEmail({ name }),
    });
    
    res.json({ 
      success: true, 
      message: 'Welcome email sent',
      emailId: response.data?.id 
    });
    
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

// Test endpoint
router.get('/test', async (req, res) => {
  try {
    const testEmail = req.query.email || 'your-email@gmail.com';
    
    const response = await resend.emails.send({
      from: 'support@blinkberrys.com',
      to: testEmail,
      subject: '🚀 Test Email from Blinkberrys',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>✅ Email System Working!</h1>
          <p>Your Resend + blinkberrys.com setup is successful!</p>
          <p><strong>Domain:</strong> blinkberrys.com ✓</p>
          <p><strong>From:</strong> support@blinkberrys.com ✓</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()} ✓</p>
        </div>
      `,
    });
    
    res.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      emailId: response.data?.id,
      note: 'Check your inbox (and spam folder)'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
