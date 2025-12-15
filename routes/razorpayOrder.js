import express from 'express';
import Razorpay from 'razorpay';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// ✅ SAFE RAZORPAY INITIALIZATION
let razorpay;
try {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  console.log('🔐 Razorpay Config Check:', {
    keyIdExists: !!keyId,
    keySecretExists: !!keySecret,
    keyIdPrefix: keyId ? keyId.substring(0, 10) + '...' : 'none'
  });
  
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys not found in environment variables');
  }
  
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  
  console.log('✅ Razorpay initialized successfully');
} catch (error) {
  console.error('❌ Razorpay initialization failed:', error.message);
  
  // Create mock razorpay for development
  razorpay = {
    orders: {
      create: async (options) => {
        console.log('📦 Mock Razorpay Order Creation:', options);
        return {
          id: `mock_order_${Date.now()}`,
          amount: options.amount,
          currency: options.currency || 'INR',
          receipt: options.receipt,
          status: 'created'
        };
      }
    }
  };
  console.log('⚠️  Using mock Razorpay for development');
}

// ✅ CREATE ORDER (Protected route)
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    console.log('📦 [RAZORPAY] Creating order request received');
    console.log('👤 User ID from auth:', req.user?.userId);
    console.log('📊 Request body:', req.body);
    
    const { amount, cartId, shippingAddress } = req.body;
    const userId = req.user.userId;

    // Validate amount
    if (!amount || amount < 1) {
      console.log('❌ Invalid amount:', amount);
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required (minimum ₹1)'
      });
    }

    // Check if cart exists
    const cart = await Cart.findById(cartId);
    if (!cart) {
      console.log('❌ Cart not found for ID:', cartId);
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }

    console.log('🛒 Cart found:', cart._id);
    console.log('💰 Converting amount:', amount, 'to paise:', Math.round(amount * 100));

    // ✅ Create order in database FIRST (simplified)
    const order = new Order({
      user: userId,
      cart: cartId,
      totalAmount: amount,
      status: 'pending',
      items: cart.items || []
    });

    await order.save();
    console.log('✅ Order saved in database:', order._id);

    // ✅ Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Rupees to paise
      currency: 'INR',
      receipt: `order_${order._id}`,
      payment_capture: 1 // Auto capture
    };

    console.log('📋 Razorpay order data:', razorpayOrderData);
    
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(razorpayOrderData);
      console.log('✅ Razorpay order created:', razorpayOrder.id);
    } catch (razorpayError) {
      console.error('❌ Razorpay API error:', razorpayError.message);
      console.error('Razorpay error details:', razorpayError.error || razorpayError);
      
      // Still save order but mark as payment pending
      order.razorpayOrderId = `error_${Date.now()}`;
      order.status = 'payment_pending';
      await order.save();
      
      return res.status(500).json({
        success: false,
        message: 'Payment gateway error: ' + razorpayError.message,
        orderId: order._id,
        debug: process.env.NODE_ENV === 'development' ? razorpayError : undefined
      });
    }

    // Save Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        yourOrderId: order._id,
        status: razorpayOrder.status
      }
    });

  } catch (error) {
    console.error('❌ [RAZORPAY] Order creation error:', error.message);
    console.error('Error stack:', error.stack);
    
    // More detailed error response
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message,
      errorType: error.name,
      debug: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : undefined
    });
  }
});

// ✅ GET ORDER STATUS (For debugging)
router.get('/order-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      order: {
        id: order._id,
        user: order.user,
        totalAmount: order.totalAmount,
        razorpayOrderId: order.razorpayOrderId,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;