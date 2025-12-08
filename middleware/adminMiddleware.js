// middleware/adminMiddleware.js main
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const adminMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;

      // Find user
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is admin
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

export default adminMiddleware;