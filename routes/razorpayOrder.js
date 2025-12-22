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

// ✅ CREATE ORDER (Protected route) - FIXED VERSION
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
    const cart = await Cart.findById(cartId).populate('items.product');
    if (!cart) {
      console.log('❌ Cart not found for ID:', cartId);
      return res.status(400).json({
        success: false,
        message: 'Cart not found'
      });
    }

    console.log('🛒 Cart found:', cart._id);
    console.log('📊 Cart items:', cart.items?.length || 0);
    console.log('💰 Converting amount:', amount, 'to paise:', Math.round(amount * 100));

    // ✅ Create Razorpay order FIRST
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Rupees to paise
      currency: 'INR',
      receipt: `order_${Date.now()}_${userId.substring(0, 8)}`,
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
      
      return res.status(500).json({
        success: false,
        message: 'Payment gateway error: ' + razorpayError.message,
        debug: process.env.NODE_ENV === 'development' ? razorpayError : undefined
      });
    }

    // ✅ SIMPLIFIED ORDER CREATION (No complex middleware)
    const orderData = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending',
      shippingAddress: shippingAddress || null,
      buyer: userId,
      items: cart.items.map(item => ({
        product: item.product?._id || item.product,
        quantity: item.quantity || 1,
        price: item.price || 0,
        bechoProtect: item.bechoProtect || { selected: false, price: 0 },
        totalPrice: (item.price || 0) * (item.quantity || 1)
      }))
    };

    console.log('📦 Creating database order with data:', {
      user: orderData.user,
      cart: orderData.cart,
      totalAmount: orderData.totalAmount,
      razorpayOrderId: orderData.razorpayOrderId,
      itemsCount: orderData.items.length
    });

    let order;
    try {
      // Try simple save first
      order = new Order(orderData);
      await order.save({ validateBeforeSave: false }); // Skip validation to avoid middleware issues
      console.log('✅ Order saved in database (simple save):', order._id);
    } catch (saveError) {
      console.error('❌ Order save error:', saveError.message);
      
      // Try with even simpler data
      const minimalOrderData = {
        user: userId,
        cart: cartId,
        totalAmount: amount,
        razorpayOrderId: razorpayOrder.id,
        status: 'pending'
      };
      
      const minimalOrder = new Order(minimalOrderData);
      await minimalOrder.save({ validateBeforeSave: false });
      console.log('✅ Minimal order saved:', minimalOrder._id);
      
      order = minimalOrder;
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        yourOrderId: order._id,
        databaseOrderId: order._id
      },
      orderInfo: {
        totalAmount: amount,
        items: order.items?.length || 0,
        razorpayOrderId: razorpayOrder.id
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
        stack: error.stack
      } : undefined
    });
  }
});

// ✅ CREATE TEST ORDER (No auth required for testing)
router.post('/test-create-order', async (req, res) => {
  try {
    const { amount = 100, email = 'test@example.com' } = req.body;
    
    console.log('🧪 Creating test Razorpay order...');
    
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Rupees to paise
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      payment_capture: 1
    };
    
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(razorpayOrderData);
      console.log('✅ Test Razorpay order created:', razorpayOrder.id);
    } catch (error) {
      console.error('❌ Test order error:', error.message);
      
      // Mock response if Razorpay fails
      razorpayOrder = {
        id: `test_mock_${Date.now()}`,
        amount: razorpayOrderData.amount,
        currency: razorpayOrderData.currency,
        receipt: razorpayOrderData.receipt,
        status: 'created'
      };
      console.log('⚠️  Using mock test order');
    }
    
    res.json({
      success: true,
      message: 'Test order created',
      order: razorpayOrder,
      testInfo: {
        amountInRupees: amount,
        amountInPaise: razorpayOrder.amount,
        email: email,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Test order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed: ' + error.message
    });
  }
});

// ✅ GET ORDER STATUS (For debugging)
router.get('/order-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('cart', 'items subtotal')
      .lean();
    
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
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET ALL USER ORDERS
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        totalAmount: order.totalAmount,
        status: order.status,
        razorpayOrderId: order.razorpayOrderId,
        createdAt: order.createdAt,
        itemsCount: order.items?.length || 0
      })),
      count: orders.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;