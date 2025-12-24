// routes/orderRoutes.js - COMPLETE FIXED VERSION
import express from 'express';
import Order from '../models/Order.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ GET USER'S ORDERS (FIXED)
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('📦 Fetching orders for user:', userId);
    
    const orders = await Order.find({ user: userId })
      .select('_id totalAmount status createdAt razorpayOrderId razorpayPaymentId items shippingAddress nimbuspostShipments') // ✅ Specific fields only
      .populate('products', 'productName brand finalPrice images condition')
      .populate('items.product', 'productName images')
      .sort({ createdAt: -1 })
      .lean(); // ✅ Use lean() for better performance
    
    console.log(`✅ Found ${orders.length} orders for user ${userId}`);
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
    
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
});

// ✅ GET ORDER DETAILS (FIXED - NO CIRCULAR REFERENCES)
router.get('/:orderId', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user.userId;
    
    console.log(`📦 Fetching order ${orderId} for user ${userId}`);
    
    const order = await Order.findOne({
      _id: orderId,
      user: userId
    })
    .select('_id totalAmount status createdAt razorpayOrderId razorpayPaymentId items shippingAddress nimbuspostShipments') // ✅ Specific fields only
    .populate('products', 'productName brand finalPrice images condition')
    .populate('items.product', 'productName images brand')
    .lean(); // ✅ Use lean() to prevent circular references
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // ✅ Clean the order object to prevent circular references
    const cleanOrder = JSON.parse(JSON.stringify(order));
    
    res.json({
      success: true,
      order: cleanOrder
    });
    
  } catch (error) {
    console.error('❌ Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order details'
    });
  }
});

// ✅ NEW: GET ORDER TRACKING DETAILS
router.get('/track/:orderId', authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user.userId;
    
    const order = await Order.findOne({
      _id: orderId,
      user: userId
    })
    .select('nimbuspostShipments shippingLegs status')
    .lean();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      shipments: order.nimbuspostShipments || [],
      legs: order.shippingLegs || [],
      status: order.status
    });
    
  } catch (error) {
    console.error('Get order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tracking'
    });
  }
});

export default router;