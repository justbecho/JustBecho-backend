import express from 'express';
import Order from '../models/Order.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ GET USER'S ORDERS
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ user: userId })
      .populate('products', 'productName brand finalPrice images condition status')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
});

// ✅ GET ORDER DETAILS
router.get('/:orderId', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user.userId;
    
    const order = await Order.findOne({
      _id: orderId,
      user: userId
    })
    .populate('products')
    .populate('seller', 'name username email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: order
    });
    
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order details'
    });
  }
});

export default router;