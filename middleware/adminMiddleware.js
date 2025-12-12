import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const adminMiddleware = async (req, res, next) => {
  try {
    console.log('👮 Admin middleware checking...');
    
    // First, check if auth middleware already ran
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    console.log('👤 User from auth middleware:', {
      email: req.user.email,
      role: req.user.role
    });
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('❌ Access denied. User role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    console.log('✅ Admin access granted for:', req.user.email);
    next();
    
  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in admin verification'
    });
  }
};

export default adminMiddleware;