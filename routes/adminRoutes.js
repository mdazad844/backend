
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { verifyAdmin, requireRole } = require('../middleware/authAdmin');

// Admin login
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

        // Find admin
        const admin = await Admin.findOne({ username: username.toLowerCase() });
        
        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check if account is locked
        if (admin.isLocked()) {
            return res.status(423).json({ 
                success: false, 
                message: 'Account is locked. Try again later.' 
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
        const token = jwt.sign(
            { 
                adminId: admin._id, 
                username: admin.username,
                role: admin.role
            },
            process.env.JWT_SECRET || 'your-jwt-secret',
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
        console.error('Admin login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
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

module.exports = router;
