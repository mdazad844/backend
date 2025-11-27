// Admin Authorization Middleware
const adminAuth = (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required. Insufficient permissions.'
      });
    }

    // User is admin, proceed to next middleware/route
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    });
  }
};

// Optional: Super admin check for critical operations
const superAdminAuth = (req, res, next) => {
  try {
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Super admin authorization failed'
    });
  }
};

module.exports = { adminAuth, superAdminAuth };