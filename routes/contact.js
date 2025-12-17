const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const Contact = require('../models/Contact');
const rateLimit = require('express-rate-limit');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Rate limiting to prevent spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: { error: 'Too many contact attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to contact routes
router.use(contactLimiter);

// Generate subject text for display
const getSubjectText = (code) => {
  const subjects = {
    'bulk-order': 'Bulk Order Inquiry',
    'custom-printing': 'Custom Printing',
    'product-info': 'Product Information',
    'shipping': 'Shipping & Delivery',
    'returns': 'Returns & Exchanges',
    'business': 'Business Partnership',
    'other': 'Other Inquiry'
  };
  return subjects[code] || code.replace(/-/g, ' ');
};

// Generate order type text
const getOrderTypeText = (code) => {
  const types = {
    'personal': 'Personal Use',
    'business': 'Business/Corporate',
    'event': 'Event/Team',
    'wholesale': 'Wholesale'
  };
  return types[code] || code;
};

// Email templates for contact form
const contactEmailTemplates = {
  // Confirmation email to user
  userConfirmation: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thank You for Contacting Blinkberrys</title>
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
        .ticket-card {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .ticket-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }
        .ticket-row:last-child {
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
        .message-box {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          font-style: italic;
          color: #555;
        }
        .next-steps {
          background: #e8f4fd;
          border-left: 4px solid #2196f3;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .next-steps h3 {
          color: #1565c0;
          margin-top: 0;
        }
        .next-steps ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin-bottom: 8px;
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
        .contact-info {
          background: #fff9e6;
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
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Message Received! 📧</h1>
          <p>We'll get back to you within 24 hours</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hi <strong>${data.name}</strong>,
          </div>
          
          <p>Thank you for contacting Blinkberrys. We've received your message and our team will review it shortly.</p>
          
          <div class="ticket-card">
            <div class="ticket-row">
              <span class="label">Ticket ID:</span>
              <span class="value">${data.ticketId}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Subject:</span>
              <span class="value">${data.subjectText}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Date:</span>
              <span class="value">${new Date().toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div class="ticket-row">
              <span class="label">Time:</span>
              <span class="value">${new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Kolkata'
              })} IST</span>
            </div>
            ${data.orderType ? `
            <div class="ticket-row">
              <span class="label">Order Type:</span>
              <span class="value">${data.orderTypeText}</span>
            </div>
            ` : ''}
            ${data.estimatedQuantity ? `
            <div class="ticket-row">
              <span class="label">Estimated Quantity:</span>
              <span class="value">${data.estimatedQuantity} pieces</span>
            </div>
            ` : ''}
          </div>
          
          <h3>Your Message:</h3>
          <div class="message-box">
            ${data.message.replace(/\n/g, '<br>')}
          </div>
          
          <div class="next-steps">
            <h3>What Happens Next?</h3>
            <ul>
              <li>Our team will review your inquiry within <strong>24 hours</strong></li>
              <li>For bulk orders, we'll provide customized pricing</li>
              <li>You'll receive updates via email</li>
              <li>Check your spam folder if you don't see our reply</li>
            </ul>
          </div>
          
          <div class="contact-info">
            <p><strong>Need immediate assistance?</strong></p>
            <p>📱 Call/WhatsApp: <a href="tel:+918512082053">+91 85120 82053</a></p>
            <p>📧 Email: <a href="mailto:orderblinkberrys@gmail.com">orderblinkberrys@gmail.com</a></p>
            <p>🕐 Business Hours: Mon-Fri 9AM-6PM, Sat 10AM-4PM IST</p>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>
            <strong>Blinkberrys Team</strong><br>
            Premium Apparel & Custom Printing Solutions</p>
            <p>📍 Delhi, India | 📧 orderblinkberrys@gmail.com | 📱 +91 85120 82053</p>
            <p><small>This is an automated message. Please do not reply to this email.</small></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  
  // Notification email to admin
  adminNotification: (data, ip) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Contact Form Submission - ${data.ticketId}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
        .label { font-weight: bold; color: #555; }
        .urgent { background: #ffebee; border-left: 4px solid #f44336; }
        .bulk { background: #e8f5e9; border-left: 4px solid #4caf50; }
        .button { display: inline-block; background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f1f1; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📨 New Contact Form Submission</h1>
          <p>Ticket ID: ${data.ticketId} | Priority: ${data.priority.toUpperCase()}</p>
        </div>
        
        <div class="content">
          <div class="section ${data.subject === 'bulk-order' ? 'bulk' : ''} ${data.priority === 'high' ? 'urgent' : ''}">
            <h2>📋 Ticket Summary</h2>
            <table>
              <tr><td class="label">Ticket ID:</td><td>${data.ticketId}</td></tr>
              <tr><td class="label">Status:</td><td><strong>NEW</strong></td></tr>
              <tr><td class="label">Priority:</td><td><strong>${data.priority.toUpperCase()}</strong></td></tr>
              <tr><td class="label">Time:</td><td>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              <tr><td class="label">Subject:</td><td><strong>${data.subjectText}</strong></td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>👤 Contact Information</h2>
            <table>
              <tr><td class="label">Name:</td><td>${data.name}</td></tr>
              <tr><td class="label">Email:</td><td><a href="mailto:${data.email}">${data.email}</a></td></tr>
              <tr><td class="label">Phone:</td><td><a href="tel:${data.phone}">${data.phone}</a></td></tr>
              ${data.orderType ? `<tr><td class="label">Order Type:</td><td>${data.orderTypeText}</td></tr>` : ''}
              ${data.estimatedQuantity ? `<tr><td class="label">Est. Quantity:</td><td>${data.estimatedQuantity} pieces</td></tr>` : ''}
            </table>
          </div>
          
          <div class="section">
            <h2>💬 Message Details</h2>
            <p><strong>Subject:</strong> ${data.subjectText}</p>
            <p><strong>Message:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #ddd; margin: 10px 0;">
              ${data.message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div class="section">
            <h2>🔧 Technical Details</h2>
            <table>
              <tr><td class="label">IP Address:</td><td>${ip}</td></tr>
              <tr><td class="label">Source:</td><td>Website Contact Form</td></tr>
              <tr><td class="label">User Agent:</td><td>${data.userAgent}</td></tr>
              <tr><td class="label">Page URL:</td><td><a href="${data.pageUrl}">${data.pageUrl}</a></td></tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.blinkberrys.com'}/contacts/${data.ticketId}" class="button">
              View in Admin Dashboard
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777;">
            <p>This is an automated notification from Blinkberrys Contact System.</p>
            <p>Response Time Target: 24 hours for normal priority, 4 hours for high priority.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
};

// Submit contact form
router.post('/submit', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      order_type,
      estimatedQuantity,
      message,
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, phone, subject, message'
      });
    }

    // Validate subject
    const validSubjects = ['bulk-order', 'custom-printing', 'product-info', 'shipping', 'returns', 'business', 'other'];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject selected'
      });
    }

    // Create contact document
    const contact = new Contact({
      name,
      email: email.toLowerCase().trim(),
      phone,
      subject,
      orderType: order_type || '',
      estimatedQuantity: estimatedQuantity ? parseInt(estimatedQuantity) : null,
      message,
      source: 'website',
      pageUrl: metadata.pageUrl || req.headers.referer || '',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      metadata: {
        ...metadata,
        formVersion: 'v1',
        browserLanguage: req.headers['accept-language']?.split(',')[0]
      }
    });

    // Save to database
    await contact.save();
    console.log('✅ Contact saved to MongoDB:', contact.ticketId);

    // Prepare email data
    const emailData = {
      ticketId: contact.ticketId,
      name,
      email,
      phone,
      subject,
      subjectText: getSubjectText(subject),
      orderType: order_type,
      orderTypeText: getOrderTypeText(order_type),
      estimatedQuantity: contact.estimatedQuantity,
      message,
      priority: contact.priority,
      pageUrl: contact.pageUrl,
      userAgent: contact.userAgent
    };

    // Send emails in parallel
    const emailPromises = [];

    // 1. Send confirmation to user
    emailPromises.push(
      resend.emails.send({
        from: 'Blinkberrys <support@blinkberrys.com>',
        to: email,
        subject: `Message Received - Ticket #${contact.ticketId}`,
        html: contactEmailTemplates.userConfirmation(emailData),
        reply_to: 'orderblinkberrys@gmail.com',
      }).catch(err => {
        console.error('❌ Failed to send user confirmation:', err.message);
        return null;
      })
    );

    // 2. Send notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'orderblinkberrys@gmail.com';
    emailPromises.push(
      resend.emails.send({
        from: 'Blinkberrys Contact System <noreply@blinkberrys.com>',
        to: adminEmail,
        subject: `New Contact: ${getSubjectText(subject)} - ${contact.ticketId}`,
        html: contactEmailTemplates.adminNotification(emailData, contact.ipAddress),
        reply_to: email,
      }).catch(err => {
        console.error('❌ Failed to send admin notification:', err.message);
        return null;
      })
    );

    // Wait for emails to be sent
    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result !== null);

    console.log(`📧 ${successfulEmails.length}/2 emails sent for ticket: ${contact.ticketId}`);

    // Return success response
    res.json({
      success: true,
      message: 'Message received successfully',
      data: {
        ticketId: contact.ticketId,
        submittedAt: contact.createdAt,
        emailsSent: successfulEmails.length,
        priority: contact.priority
      }
    });

  } catch (error) {
    console.error('❌ Contact submission error:', error);

    // Handle duplicate ticket ID error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate submission detected. Please try again.'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

// Get contact messages (admin only - protected route)
router.get('/messages', async (req, res) => {
  try {
    // In production, add authentication middleware here
    const { 
      page = 1, 
      limit = 20, 
      status, 
      subject, 
      priority, 
      search 
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (subject) query.subject = subject;
    if (priority) query.priority = priority;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      Contact.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Contact.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// Get contact statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const stats = await Contact.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Update contact status (admin only)
router.put('/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, note, userId } = req.body;

    const contact = await Contact.findOne({ ticketId });
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    contact.status = status || contact.status;
    
    if (note && userId) {
      await contact.addInternalNote(note, userId);
    }

    await contact.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: contact
    });

  } catch (error) {
    console.error('❌ Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

// Test endpoint
router.get('/test', async (req, res) => {
  try {
    const testData = {
      name: 'Test User',
      email: req.query.email || 'test@example.com',
      phone: '+919876543210',
      subject: 'bulk-order',
      message: 'This is a test message from the contact form API.',
      order_type: 'business',
      estimatedQuantity: 500
    };

    // Test database connection
    const contact = new Contact(testData);
    await contact.save();
    
    // Test email sending
    const emailResult = await resend.emails.send({
      from: 'Blinkberrys <support@blinkberrys.com>',
      to: testData.email,
      subject: '✅ Contact Form API Test',
      html: '<h1>API Test Successful!</h1><p>Your contact form API is working correctly.</p>'
    });

    // Clean up test data
    await Contact.deleteOne({ _id: contact._id });

    res.json({
      success: true,
      message: 'Contact form API test successful',
      data: {
        database: 'connected',
        email: 'sent',
        emailId: emailResult.data?.id,
        ticketId: contact.ticketId
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

module.exports = router;
