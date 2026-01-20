import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ✅ SPECIFIC MIDDLEWARE FOR ADMIN DASHBOARD ONLY
const adminAuthMiddleware = async (req, res, next) => {
  try {
    console.log('🔐 Admin Auth Middleware - Checking admin access...');
    
    // Skip for login route
    if (req.path === '/login' || req.method === 'OPTIONS') {
      console.log('✅ Skipping auth for admin login/options');
      return next();
    }
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token found for admin route');
      return res.status(401).json({
        success: false,
        message: 'Admin access requires authentication'
      });
    }
    
    console.log('✅ Admin token found, verifying...');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId || decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Check if admin
    if (user.role !== 'admin') {
      console.log('❌ User is not admin:', user.role);
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }
    
    req.user = user;
    console.log('✅ Admin authenticated:', user.email);
    next();
    
  } catch (error) {
    console.error('❌ Admin auth error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Admin token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Admin authentication failed'
    });
  }
};

export default adminAuthMiddleware;