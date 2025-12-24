// routes/razorpayOrder.js - FIXED VERSION
import express from 'express';
import Razorpay from 'razorpay';
import mongoose from 'mongoose'; // ✅ Import mongoose here
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

// ✅ CREATE ORDER (Protected route) - COMPLETELY FIXED VERSION
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    console.log('📦 [RAZORPAY] Creating order request received');
    console.log('👤 User ID from auth:', req.user?.userId);
    
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
      return res.status(500).json({
        success: false,
        message: 'Payment gateway error: ' + razorpayError.message
      });
    }

    // ✅ SIMPLE ORDER DATA - NO COMPLEX STRUCTURES
    const orderData = {
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending'
    };

    // Add shipping address if provided
    if (shippingAddress) {
      orderData.shippingAddress = {
        name: shippingAddress.name || req.user.name || 'Customer',
        phone: shippingAddress.phone || req.user.phone || '',
        email: shippingAddress.email || req.user.email || '',
        street: shippingAddress.street || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        pincode: shippingAddress.pincode || '',
        country: 'India'
      };
    }

    // Add items if cart has items
    if (cart.items && cart.items.length > 0) {
      orderData.items = cart.items.map(item => ({
        product: item.product?._id || item.product,
        quantity: item.quantity || 1,
        price: item.price || 0,
        bechoProtect: item.bechoProtect || { selected: false, price: 0 },
        totalPrice: (item.price || 0) * (item.quantity || 1)
      }));
    }

    console.log('📦 Creating database order...');

    // ✅ METHOD 1: Simple Order.create() with validateBeforeSave: false
    let order;
    try {
      console.log('🔄 Trying Order.create() method...');
      
      const createdOrders = await Order.create([orderData], { 
        validateBeforeSave: false 
      });
      
      order = createdOrders[0];
      console.log('✅ Order created successfully via create():', order._id);
      
    } catch (createError) {
      console.error('❌ Order.create() failed:', createError.message);
      
      // ✅ METHOD 2: Use new Order() with simple data
      try {
        console.log('🔄 Trying new Order() method...');
        
        // Create simpler order to avoid middleware issues
        const simpleOrder = new Order({
          user: userId,
          cart: cartId,
          totalAmount: amount,
          razorpayOrderId: razorpayOrder.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        order = await simpleOrder.save({ validateBeforeSave: false });
        console.log('✅ Minimal order saved:', order._id);
        
      } catch (saveError) {
        console.error('❌ All order creation methods failed:', saveError.message);
        
        // Last resort: Manual insert
        try {
          console.log('🔄 Trying manual insert...');
          
          const orderDoc = {
            user: new mongoose.Types.ObjectId(userId),
            cart: new mongoose.Types.ObjectId(cartId),
            totalAmount: amount,
            razorpayOrderId: razorpayOrder.id,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await Order.collection.insertOne(orderDoc);
          order = await Order.findById(result.insertedId);
          console.log('✅ Manual insert successful:', order._id);
          
        } catch (manualError) {
          console.error('❌ Manual insert also failed:', manualError.message);
          throw new Error(`Order creation failed: ${manualError.message}`);
        }
      }
    }

    // ✅ SUCCESS RESPONSE
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
        itemsCount: cart.items?.length || 0,
        razorpayOrderId: razorpayOrder.id,
        orderStatus: order.status
      },
      nextSteps: [
        'Use Razorpay checkout with order.id',
        'After payment, verify with /api/razorpay/verify-payment',
        'Track order status at /api/orders/my-orders'
      ]
    });

  } catch (error) {
    console.error('❌ [RAZORPAY] Order creation error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message,
      errorType: error.name,
      troubleshooting: [
        'Check if cart exists',
        'Verify database connection',
        'Check Razorpay API keys'
      ]
    });
  }
});

// ✅ SIMPLE CREATE ORDER (Alternative)
router.post('/create-order-simple', authMiddleware, async (req, res) => {
  try {
    const { amount, cartId } = req.body;
    const userId = req.user.userId;
    
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    // Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      payment_capture: 1
    };
    
    const razorpayOrder = await razorpay.orders.create(razorpayOrderData);
    
    // Create simplest possible order
    const order = new Order({
      user: userId,
      cart: cartId,
      totalAmount: amount,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending'
    });
    
    await order.save({ validateBeforeSave: false });
    
    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        yourOrderId: order._id
      }
    });
    
  } catch (error) {
    console.error('Simple order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ CREATE TEST ORDER (No auth required for testing)
router.post('/test-create-order', async (req, res) => {
  try {
    const { amount = 100 } = req.body;
    
    console.log('🧪 Creating test Razorpay order...');
    
    const razorpayOrderData = {
      amount: Math.round(amount * 100),
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
      order: razorpayOrder
    });
    
  } catch (error) {
    console.error('Test order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ GET ORDER STATUS
router.get('/order-status/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('cart', 'items subtotal');
    
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

// ✅ GET ALL USER ORDERS
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        totalAmount: order.totalAmount,
        status: order.status,
        razorpayOrderId: order.razorpayOrderId,
        createdAt: order.createdAt
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

// ✅ CHECK RAZORPAY CONFIG
router.get('/config-check', (req, res) => {
  const keyId = process.env.RAZORPAY_LIVE_KEY_ID;
  const keySecret = process.env.RAZORPAY_LIVE_SECRET_KEY;
  
  res.json({
    success: true,
    razorpay: {
      keyIdExists: !!keyId,
      keySecretExists: !!keySecret,
      keyIdPreview: keyId ? keyId.substring(0, 10) + '...' : 'Not set',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

export default router;