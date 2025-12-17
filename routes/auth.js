// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// JWT Secret - Add to your .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many attempts, please try again later.' },
  standardHeaders: true
});

// Apply rate limiting to auth routes
router.use(authLimiter);

// Helper: Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

// Helper: Send email
const sendEmail = async (to, subject, html) => {
  try {
    const fromEmail = process.env.FROM_EMAIL || 'Blinkberrys <support@blinkberrys.com>';
    
    const data = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html
    });
    
    console.log('📧 Email sent:', data.data?.id);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error };
  }
};

// 📝 REGISTER USER
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, phone, password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      addresses: address ? [{
        ...address,
        isDefault: true
      }] : [],
      status: 'active'
    });

    await user.save();
    console.log('✅ User registered:', user.email);

    // Generate JWT token
    const token = generateToken(user._id);

    // Send welcome email
    const welcomeEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Blinkberrys!</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Welcome to Blinkberrys! 🎉</h1>
          <p>Your account has been successfully created</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Thank you for joining Blinkberrys! We're excited to have you on board.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0;">Your Account Details:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Member Since:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://blinkberrys.com'}/shop" 
               style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Start Shopping →
            </a>
          </div>
          
          <p><strong>Need help?</strong> Contact us at <a href="mailto:orderblinkberrys@gmail.com">orderblinkberrys@gmail.com</a></p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Best regards,<br>The Blinkberrys Team</p>
            <p>📍 Delhi, India | 📧 orderblinkberrys@gmail.com | 📱 +91 85120 82053</p>
            <p><em>This is an automated message. Please do not reply to this email.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      email,
      'Welcome to Blinkberrys! Your Account is Ready',
      welcomeEmailHtml
    );

    // Return success response
    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 🔑 LOGIN USER
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);
    
    console.log('✅ User logged in:', user.email);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 📧 FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security, don't reveal if user doesn't exist
      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent'
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token
    const passwordReset = new PasswordReset({
      email: user.email,
      token,
      expiresAt,
      ipAddress: ip,
      userAgent
    });

    await passwordReset.save();

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL || 'https://blinkberrys.com'}/reset-password.html?token=${token}`;

    // Send reset email
    const resetEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Blinkberrys Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ff6b6b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Reset Your Password</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>We received a request to reset your password for your Blinkberrys account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; background: #ff6b6b; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p><strong>Important:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>For security, never share your password with anyone</li>
            </ul>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="background: white; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
            ${resetLink}
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Best regards,<br>The Blinkberrys Security Team</p>
            <p>📍 Delhi, India | 📧 orderblinkberrys@gmail.com | 📱 +91 85120 82053</p>
            <p><em>This is an automated message. Please do not reply to this email.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResult = await sendEmail(
      user.email,
      'Reset Your Blinkberrys Password',
      resetEmailHtml
    );

    if (emailResult.success) {
      console.log('✅ Password reset email sent to:', user.email);
      res.json({
        success: true,
        message: 'Password reset link sent to your email'
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request'
    });
  }
});

// 🔄 RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find valid reset token
    const passwordReset = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Find user
    const user = await User.findOne({ email: passwordReset.email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user password
    user.password = password;
    await user.save();

    // Mark token as used
    passwordReset.used = true;
    await passwordReset.save();

    // Send confirmation email
    const confirmEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Changed Successfully</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">✅ Password Changed</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your Blinkberrys account password has been successfully changed.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="margin-top: 0;">Change Details:</h3>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
            <p><strong>Account:</strong> ${user.email}</p>
          </div>
          
          <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3; margin: 20px 0;">
            <p><strong>Security Note:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>If you didn't make this change, contact us immediately</li>
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://blinkberrys.com'}/login" 
               style="display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Login to Your Account
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Best regards,<br>The Blinkberrys Security Team</p>
            <p>📍 Delhi, India | 📧 orderblinkberrys@gmail.com | 📱 +91 85120 82053</p>
            <p><em>This is an automated message. Please do not reply to this email.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      user.email,
      'Your Blinkberrys Password Has Been Changed',
      confirmEmailHtml
    );

    console.log('✅ Password reset successful for:', user.email);

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// 👤 GET USER PROFILE (protected route)
router.get('/profile', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('❌ Profile error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ✅ TEST ENDPOINT
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth API is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      forgotPassword: 'POST /api/auth/forgot-password',
      resetPassword: 'POST /api/auth/reset-password',
      profile: 'GET /api/auth/profile'
    }
  });
});

module.exports = router;
