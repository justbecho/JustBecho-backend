import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔐 Auth Middleware - Starting authentication check...');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token found in Authorization header');
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    console.log('✅ Token found, length:', token.length);
    
    // ✅ Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified successfully');
      console.log('📋 Decoded token:', decoded);
    } catch (verifyError) {
      console.error('❌ Token verification failed:', verifyError.message);
      
      if (verifyError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (verifyError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }

    // ✅ Handle both old and new token structures
    let userId;
    
    if (decoded.userId) {
      userId = decoded.userId;
      console.log('🆔 Using userId from token:', userId);
    } else if (decoded.id) {
      userId = decoded.id;
      console.log('🆔 Using id from token:', userId);
    } else {
      console.error('❌ Invalid token structure:', decoded);
      return res.status(401).json({
        success: false,
        message: 'Invalid token structure'
      });
    }

    console.log('🔍 Looking for user in database with ID:', userId);
    
    // ✅ Find user in database
    let user;
    try {
      user = await User.findById(userId).select('-password');
      
      if (!user) {
        console.log('❌ User not found in database for ID:', userId);
        return res.status(401).json({
          success: false,
          message: 'User not found - token is not valid'
        });
      }
      
      console.log('✅ User found in database:', {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      return res.status(500).json({
        success: false,
        message: 'Database error while fetching user'
      });
    }

    // ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
    // PERMANENT FIX: Set user object with ALL POSSIBLE ID PROPERTIES
    // ✅ ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
    req.user = {
      // ✅ MOST IMPORTANT: Add ALL ID properties for compatibility
      id: user._id.toString(),           // Used by getUserProducts and other functions
      _id: user._id,                     // Original MongoDB ID
      userId: user._id.toString(),       // For backward compatibility
      
      // ✅ User basic info
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role || 'buyer',
      
      // ✅ Profile status
      profileCompleted: user.profileCompleted || false,
      sellerVerified: user.sellerVerified || false,
      sellerVerificationStatus: user.sellerVerificationStatus || 'not_started',
      verificationId: user.verificationId || null,
      
      // ✅ Additional info
      username: user.username || null,
      phone: user.phone || null,
      address: user.address || null,
      bankDetails: user.bankDetails || null,
      instaId: user.instaId || null,
      
      // ✅ For debugging
      originalTokenUserId: userId
    };
    
    console.log('✅✅✅ Auth Middleware SUCCESS - User object set in req.user:', {
      id: req.user.id,
      userId: req.user.userId,
      _id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
      sellerVerified: req.user.sellerVerified,
      profileCompleted: req.user.profileCompleted
    });
    
    console.log('✅ All user properties set:', Object.keys(req.user));
    
    next();
  } catch (error) {
    console.error('❌❌❌ Auth middleware UNEXPECTED error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Send detailed error in development
    const errorResponse = {
      success: false,
      message: 'Authentication failed',
      error: error.message
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.details = {
        name: error.name,
        code: error.code
      };
    }
    
    res.status(500).json(errorResponse);
  }
};

// ✅ OPTIONAL: ROLE-BASED MIDDLEWARE
export const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      console.log('👑 Role check middleware - Checking roles:', roles);
      
      if (!req.user) {
        console.log('❌ No user found for role check');
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      console.log('👤 User role:', req.user.role);
      console.log('🎯 Required roles:', roles);
      
      if (!roles.includes(req.user.role)) {
        console.log('❌ Role check failed. User role:', req.user.role, 'Required:', roles);
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
        });
      }

      console.log('✅ Role check passed');
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
    console.log('📝 Profile completion check');
    
    if (!req.user) {
      console.log('❌ No user found for profile check');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    console.log('👤 User profileCompleted:', req.user.profileCompleted);
    
    if (!req.user.profileCompleted) {
      console.log('❌ Profile not completed');
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile to access this resource'
      });
    }

    console.log('✅ Profile check passed');
    next();
  } catch (error) {
    console.error('❌ Profile completion middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in profile validation'
    });
  }
};

// ✅ OPTIONAL: SELLER VERIFICATION MIDDLEWARE
export const requireSellerVerified = (req, res, next) => {
  try {
    console.log('✅ Seller verification check');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'seller') {
      return res.status(403).json({
        success: false,
        message: 'Seller account required'
      });
    }

    if (!req.user.sellerVerified) {
      return res.status(403).json({
        success: false,
        message: 'Seller verification required. Please wait for admin approval.'
      });
    }

    console.log('✅ Seller verification check passed');
    next();
  } catch (error) {
    console.error('❌ Seller verification middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in seller verification'
    });
  }
};

export default authMiddleware;