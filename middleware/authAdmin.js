const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const verifyAdmin = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
        
        // Find admin and check if still active
        const admin = await Admin.findOne({ 
            _id: decoded.adminId, 
            isActive: true 
        });

        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin account not found or inactive' 
            });
        }

        // Add admin info to request
        req.admin = {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role
        };
        
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        
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
        
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Optional: Role-based middleware
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authenticated' 
            });
        }
        
        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Insufficient permissions' 
            });
        }
        
        next();
    };
};

module.exports = { verifyAdmin, requireRole };
