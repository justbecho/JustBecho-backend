import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 Token decoded:', decoded);

    // ✅ Handle both old and new token structures
    let userId;
    
    if (decoded.userId) {
      userId = decoded.userId;
    } else if (decoded.id) {
      userId = decoded.id;
    } else {
      throw new Error('Invalid token structure');
    }

    console.log('🔍 Looking for user with ID:', userId);
    
    // ✅ Find user in database
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found - token is not valid'
      });
    }

    // ✅ PERMANENT FIX: Consistent user object structure with ALL DATA
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role, // ✅ This will now show 'admin'
      profileCompleted: user.profileCompleted,
      sellerVerified: user.sellerVerified,
      sellerVerificationStatus: user.sellerVerificationStatus,
      verificationId: user.verificationId,
      username: user.username,
      phone: user.phone,
      address: user.address,
      bankDetails: user.bankDetails,
      instaId: user.instaId
    };
    
    console.log('✅ Auth Middleware - User set:', {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role, // ✅ Check if it shows 'admin'
      name: req.user.name
    });
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
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
    
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// ✅ OPTIONAL: ROLE-BASED MIDDLEWARE
export const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('❌ Role middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error in role validation'
      });
    }
  };
};

// ✅ OPTIONAL: PROFILE COMPLETION MIDDLEWARE
export const requireProfileCompleted = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.profileCompleted) {
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile to access this resource'
      });
    }

    next();
  } catch (error) {
    console.error('❌ Profile completion middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in profile validation'
    });
  }
};

export default authMiddleware;