
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { verifyAdmin, requireRole } = require('../middleware/authAdmin');

// GET /api/admin - Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MyBrand Admin API',
    version: '1.0.0',
    endpoints: {
      login: 'POST /api/admin/login',
      profile: 'GET /api/admin/profile',
      validate: 'POST /api/admin/validate',
      logout: 'POST /api/admin/logout',
      changePassword: 'POST /api/admin/change-password',
      createAdmin: 'POST /api/admin/create (superadmin only)'
    },
    timestamp: new Date().toISOString(),
    docs: 'https://backend-production-c281a.up.railway.app/api/admin'
  });
});

// Admin login
// In routes/adminRoutes.js, update the login function:
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        // 🔥 IMPORTANT: Get fresh mongoose connection
        const mongoose = require('mongoose');
        
        // Check if already connected
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️ MongoDB not connected, reconnecting...');
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Find admin
        const Admin = require('../models/Admin');
        const admin = await Admin.findOne({ username: username.toLowerCase() });
        
        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check password
        const isValidPassword = await admin.checkPassword(password);
        
        if (!isValidPassword) {
            // Increment failed attempts
            await admin.incrementLoginAttempts();
            
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Reset login attempts and update last login
        await admin.resetLoginAttempts();

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                adminId: admin._id, 
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET || 'your-jwt-secret-fallback',
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });

    } catch (error) {
        console.error('Admin login error:', error.message);
        console.error('Full error:', error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});
// Admin logout (optional - client side token removal)
router.post('/logout', verifyAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Get current admin profile
router.get('/profile', verifyAdmin, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-passwordHash');
        
        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Admin not found' 
            });
        }

        res.json({
            success: true,
            admin
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Update admin profile
router.put('/profile', verifyAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        const updates = {};
        
        if (email) updates.email = email;

        const admin = await Admin.findByIdAndUpdate(
            req.admin.id,
            updates,
            { new: true, runValidators: true }
        ).select('-passwordHash');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            admin
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Change password
router.post('/change-password', verifyAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Current and new password are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 6 characters' 
            });
        }

        const admin = await Admin.findById(req.admin.id);
        
        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Admin not found' 
            });
        }

        // Verify current password
        const isValid = await admin.checkPassword(currentPassword);
        
        if (!isValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }

        // Update password
        admin.passwordHash = newPassword;
        await admin.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Create new admin (only for superadmin)
router.post('/create', verifyAdmin, requireRole('superadmin'), async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, email and password are required' 
            });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ 
            $or: [{ username }, { email }] 
        });

        if (existingAdmin) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }

        // Create new admin
        const newAdmin = new Admin({
            username,
            email,
            passwordHash: password,
            role: role || 'admin'
        });

        await newAdmin.save();

        // Remove password hash from response
        const adminResponse = newAdmin.toObject();
        delete adminResponse.passwordHash;

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            admin: adminResponse
        });

    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Validate token
router.post('/validate', verifyAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        admin: req.admin
    });
});


// ... [ALL YOUR EXISTING CODE ABOVE] ...

// ==================== ADD EMERGENCY CODE HERE ====================
// 🔥 ADD THIS RIGHT BEFORE module.exports = router;

// ========== TEMPORARY EMERGENCY PASSWORD RESET ==========
// Use ONCE then DELETE IMMEDIATELY after use
router.post('/emergency-reset', async (req, res) => {
    console.log('🔐 EMERGENCY PASSWORD RESET ATTEMPT');
    
    try {
        // 1. SECRET CHECK - CHANGE THIS SECRET!
        const SECRET_KEY = 'blinkAzaDberrys987!@#'; // ⚠️ CHANGE THIS to your own secret!
        if (req.headers['x-emergency-key'] !== SECRET_KEY) {
            console.log('❌ Invalid reset secret');
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized' 
            });
        }
        
        // 2. Connect to MongoDB
        const mongoose = require('mongoose');
        const bcrypt = require('bcryptjs');
        
        // Connect if not connected
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        const db = mongoose.connection.db;
        
        // 3. Generate NEW secure password
        const crypto = require('crypto');
        const newPassword = crypto.randomBytes(10).toString('hex') + '!Aa1'; // Example: a3f8b91c7e!Aa1
        
        // 4. Hash and update
        const hash = await bcrypt.hash(newPassword, 12);
        
        const result = await db.collection('admins').updateOne(
            { username: 'admin' }, // Assumes your username is 'admin'
            { $set: { 
                passwordHash: hash,
                loginAttempts: 0, // Reset lockouts
                lockUntil: null
            }}
        );
        
        if (result.modifiedCount === 0) {
            // Try with username 'admin@mybrand.com' or check what username exists
            return res.status(404).json({ 
                success: false, 
                message: 'Admin account not found with username "admin"' 
            });
        }
        
        // 5. Return success (password shown in logs)
        console.log('✅ Password reset for admin');
        console.log('========================================');
        console.log('⚠️  EMERGENCY PASSWORD RESET COMPLETE');
        console.log('⚠️  NEW PASSWORD:', newPassword);
        console.log('⚠️  LOGIN WITH: admin /', newPassword);
        console.log('⚠️  SAVE THIS - It will not be shown again');
        console.log('========================================');
        
        res.json({
            success: true,
            message: 'Password reset successful. Check SERVER LOGS for new password.',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Reset error:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during reset',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ========== END OF EMERGENCY CODE ==========

module.exports = router;

module.exports = router;
